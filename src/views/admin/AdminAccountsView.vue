<script setup lang="ts">
import { ref, computed } from "vue";
import { useAccountStore } from "../../stores/accountStore";
import AccountForm from "../../components/account/AccountForm.vue";
import CurrencyDisplay from "../../components/ui/CurrencyDisplay.vue";
import { type Account, AccountType, type AccountGroup } from "../../types";
import AccountGroupForm from "../../components/account/AccountGroupForm.vue";
import { useRouter } from "vue-router";
import { Icon } from "@iconify/vue";
import { BalanceService } from "../../services/BalanceService";
import { AccountService } from "../../services/AccountService";
import { debugLog, infoLog, errorLog } from "../../utils/logger";

// Stores
const accountStore = useAccountStore();
const router = useRouter();

const showAccountModal = ref(false);
const showGroupModal = ref(false);

const selectedAccount = ref<Account | null>(null);
const selectedGroup = ref<AccountGroup | null>(null);

const isEditMode = ref(false);
const isGroupEditMode = ref(false);

const accounts = computed(() => {
  return [...accountStore.accounts].sort((a, b) => {
    // Finde die entsprechenden Gruppen
    const groupA = accountStore.accountGroups.find(
      (g) => g.id === a.accountGroupId
    );
    const groupB = accountStore.accountGroups.find(
      (g) => g.id === b.accountGroupId
    );

    // Zuerst nach Gruppen-SortOrder sortieren
    const groupSortA = groupA?.sortOrder || 0;
    const groupSortB = groupB?.sortOrder || 0;

    if (groupSortA !== groupSortB) {
      return groupSortA - groupSortB;
    }

    // Bei gleicher Gruppen-SortOrder nach Account-SortOrder sortieren
    return (a.sortOrder || 0) - (b.sortOrder || 0);
  });
});

const accountGroups = computed(() => {
  return [...accountStore.accountGroups].sort(
    (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)
  );
});

const getGroupName = (groupId: string) => {
  const group = accountGroups.value.find((g: AccountGroup) => g.id === groupId);
  return group ? group.name : "Unbekannt";
};

const getGroupBalance = (groupId: string) => {
  const balances = AccountService.getGroupBalances();
  return balances[groupId] ?? 0;
};

const formatAccountType = (type: AccountType): string => {
  // Das Enum enthält jetzt direkt die lesbaren Namen als Keys.
  // Wir müssen nur den Wert finden, der dem Key entspricht.
  const key = Object.keys(AccountType).find(
    (key) => AccountType[key as keyof typeof AccountType] === type
  );
  return key || "Unbekannt";
};

const editAccount = (account: Account) => {
  selectedAccount.value = account;
  isEditMode.value = true;
  showAccountModal.value = true;
};

const createAccount = () => {
  selectedAccount.value = null;
  isEditMode.value = false;
  showAccountModal.value = true;
};

const saveAccount = async (
  accountData: Omit<Account, "id" | "uuid" | "balance">
) => {
  if (isEditMode.value && selectedAccount.value) {
    await AccountService.updateAccount(selectedAccount.value.id, accountData);
  } else {
    await AccountService.addAccount(accountData);
  }
  showAccountModal.value = false;
};

const deleteAccount = (account: Account) => {
  if (confirm(`Möchten Sie das Konto "${account.name}" wirklich löschen?`)) {
    AccountService.deleteAccount(account.id);
  }
};

const updateAccountGroup = async (account: Account, newGroupId: string) => {
  // Prüfe, ob sich die Gruppe tatsächlich geändert hat
  if (account.accountGroupId === newGroupId) {
    debugLog(
      "AdminAccountsView",
      `Account ${account.name} bleibt in derselben Gruppe ${newGroupId}`,
      { accountId: account.id, groupId: newGroupId }
    );
    return;
  }

  try {
    // Verwende die gleiche Service-Methode wie beim Drag & Drop
    // Diese Methode berechnet automatisch die sortOrder für beide Gruppen neu
    await AccountService.moveAccountToGroup(account.id, newGroupId, 0); // An Position 0 (Anfang der Zielgruppe)

    infoLog(
      "AdminAccountsView",
      `Account ${account.name} erfolgreich zu Gruppe ${newGroupId} verschoben`,
      { accountId: account.id, oldGroupId: account.accountGroupId, newGroupId }
    );
  } catch (error) {
    errorLog(
      "AdminAccountsView",
      `Fehler beim Verschieben von Account ${account.name} zu Gruppe ${newGroupId}`,
      {
        accountId: account.id,
        oldGroupId: account.accountGroupId,
        newGroupId,
        error,
      }
    );
  }
};

const editAccountGroup = (group: AccountGroup) => {
  selectedGroup.value = group;
  isGroupEditMode.value = true;
  showGroupModal.value = true;
};

const createAccountGroup = () => {
  selectedGroup.value = null;
  isGroupEditMode.value = false;
  showGroupModal.value = true;
};

const saveAccountGroup = async (groupData: Omit<AccountGroup, "id">) => {
  if (isGroupEditMode.value && selectedGroup.value) {
    await AccountService.updateAccountGroup(selectedGroup.value.id, groupData);
  } else {
    await AccountService.addAccountGroup(groupData);
  }
  showGroupModal.value = false;
};

const deleteAccountGroup = async (groupId: string) => {
  if (confirm("Möchten Sie die Kontogruppe wirklich löschen?")) {
    debugLog(
      "[AdminAccountsView]",
      "deleteAccountGroup",
      "Versuche Kontogruppe zu löschen",
      { groupId }
    );
    const success = await AccountService.deleteAccountGroup(groupId);
    debugLog(
      "[AdminAccountsView]",
      "deleteAccountGroup",
      "Löschvorgang abgeschlossen",
      { groupId, success }
    );
    if (!success) {
      alert(
        "Kontogruppe konnte nicht gelöscht werden. Stellen Sie sicher, dass keine Konten mehr in dieser Gruppe vorhanden sind."
      );
    }
  }
};

/**
 * Aktualisiert die Monatssalden aller Konten. Zentral für die Finanzübersicht.
 */
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
            <Icon
              icon="mdi:folder-plus"
              class="mr-2 text-base"
            />
            Neue Gruppe
          </button>
          <button
            class="btn join-item rounded-r-full btn-sm btn-soft border border-base-300"
            @click="createAccount"
          >
            <Icon
              icon="mdi:plus"
              class="mr-2 text-base"
            />
            Neues Konto
          </button>
        </div>
        <!-- Neuer Button für manuelle Aktualisierung der Monatssalden -->
        <button
          class="btn btn-soft btn-sm ml-4 border border-base-300"
          @click="updateMonthlyBalances"
        >
          <Icon
            icon="mdi:refresh"
            class="mr-2 text-base"
          />
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
              <tr
                v-for="account in accounts"
                :key="account.id"
              >
                <td>{{ account.name }}</td>
                <td>
                  <select
                    class="select select-sm w-full rounded-full border border-base-300"
                    :value="account.accountGroupId"
                    @change="
                      updateAccountGroup(
                        account,
                        ($event.target as HTMLSelectElement).value
                      )
                    "
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
                    class="text-right whitespace-nowrap"
                    :amount="AccountService.getCurrentBalance(account.id)"
                    :show-zero="true"
                    :asInteger="false"
                  />
                </td>
                <td class="text-center">
                  <div
                    class="badge rounded-full badge-soft"
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
                    <Icon
                      icon="mdi:pencil"
                      class="text-base"
                    />
                  </button>
                  <button
                    class="btn btn-ghost btn-xs text-error"
                    @click="deleteAccount(account)"
                  >
                    <Icon
                      icon="mdi:trash-can"
                      class="text-base"
                    />
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
                <th class="text-center">Anzahl Konten</th>
                <th class="text-right">Gesamtsaldo</th>
                <th class="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="group in accountGroups"
                :key="group.id"
              >
                <td>{{ group.name }}</td>
                <td class="text-center">
                  {{
                    accounts.filter(
                      (a: Account) => a.accountGroupId === group.id
                    ).length
                  }}
                </td>
                <td class="text-right">
                  <CurrencyDisplay
                    class="text-right whitespace-nowrap"
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
                    <Icon
                      icon="mdi:pencil"
                      class="text-base"
                    />
                  </button>
                  <button
                    class="btn btn-ghost btn-xs text-error"
                    @click="deleteAccountGroup(group.id)"
                  >
                    <Icon
                      icon="mdi:trash-can"
                      class="text-base"
                    />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Konto-Modal -->
    <div
      v-if="showAccountModal"
      class="modal modal-open"
    >
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
      <div
        class="modal-backdrop"
        @click="showAccountModal = false"
      ></div>
    </div>

    <!-- AccountGroup-Modal -->
    <div
      v-if="showGroupModal"
      class="modal modal-open"
    >
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
      <div
        class="modal-backdrop"
        @click="showGroupModal = false"
      ></div>
    </div>
  </div>
</template>
