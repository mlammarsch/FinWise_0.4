<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useAccountStore } from "../../../stores/accountStore";
import { BalanceService } from "../../../services/BalanceService";
import CurrencyDisplay from "../CurrencyDisplay.vue";

const props = withDefaults(
  defineProps<{
    showHeader?: boolean;
    showActions?: boolean;
  }>(),
  {
    showHeader: true,
    showActions: true,
  }
);

const router = useRouter();
const accountStore = useAccountStore();

const totalBalance = computed(() => BalanceService.getTotalBalance());

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

const GROUP_ROW_ESTIMATE = 52; // px, geschätzte Höhe pro Gruppe
const GROUP_GAP = 8; // px, vertikaler Abstand zwischen Gruppen
const MAX_GROUP_ROWS = 6; // max. sichtbare Gruppen-Zeilen bevor Scroll aktiviert wird

const groupsListStyle = computed(() => {
  const maxHeight =
    MAX_GROUP_ROWS * GROUP_ROW_ESTIMATE + (MAX_GROUP_ROWS - 1) * GROUP_GAP;
  return {
    maxHeight: `${maxHeight}px`,
    overflowY: "auto",
    overflowX: "hidden",
  } as Record<string, string>;
});

function navigateToAccounts() {
  router.push("/accounts");
}
</script>

<template>
  <div>
    <div class="flex justify-between items-center mb-4">
      <h3
        v-if="showHeader"
        class="card-title text-lg"
      >
        Kontostand
      </h3>
      <button
        v-if="showActions"
        class="btn btn-sm btn-ghost"
        @click="navigateToAccounts"
      >
        Details
        <span
          class="iconify ml-1"
          data-icon="mdi:chevron-right"
        ></span>
      </button>
    </div>

    <div class="mb-4">
      <p class="text-2xl font-bold">
        <CurrencyDisplay
          :amount="totalBalance"
          :asInteger="true"
        />
      </p>
      <p class="text-sm opacity-60">Gesamtsaldo aller Konten</p>
    </div>

    <div
      class="space-y-2 mb-4 ag-list"
      :style="groupsListStyle"
    >
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
                :asInteger="true"
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
                  :asInteger="true"
                />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
.ag-list {
  overflow-x: hidden;
  scrollbar-width: thin; /* Firefox */
}

.ag-list::-webkit-scrollbar {
  width: 8px;
}

.ag-list::-webkit-scrollbar-thumb {
  @apply rounded-full;
  background-color: color-mix(
    in oklab,
    var(--fallback-bc, oklch(var(--bc) / 1)) 30%,
    transparent
  );
}
</style>
