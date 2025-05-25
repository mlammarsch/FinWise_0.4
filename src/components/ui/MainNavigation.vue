<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { Icon } from "@iconify/vue";
import { useAccountStore } from "../../stores/accountStore";
import { useCategoryStore } from "../../stores/categoryStore";
import { useRecipientStore } from "../../stores/recipientStore";
import { useTagStore } from "../../stores/tagStore";
import { useTransactionStore } from "../../stores/transactionStore";
import { usePlanningStore } from "../../stores/planningStore";
import { useRuleStore } from "../../stores/ruleStore";
import { useStatisticsStore } from "../../stores/statisticsStore";
import { useThemeStore } from "../../stores/themeStore";

const emit = defineEmits(["closeMenu"]);

const router = useRouter();

const routes = [
  { path: "/", name: "Dashboard", icon: "mdi:view-dashboard" },
  { path: "/accounts", name: "Konten", icon: "mdi:bank" },
  { path: "/transactions", name: "Transaktionen", icon: "mdi:swap-horizontal" },
  { path: "/budgets", name: "Budgets", icon: "mdi:wallet" },
  { path: "/statistics", name: "Statistiken", icon: "mdi:chart-bar" },
  { path: "/planning", name: "Planung", icon: "mdi:calendar" },
];

/* --------------------------- Admin-Routen --------------------------- */
const adminRoutes = [
  { path: "/admin/accounts", name: "Konten verwalten", icon: "mdi:cash-edit" },
  {
    path: "/admin/categories",
    name: "Kategorien verwalten",
    icon: "mdi:category",
  },
  { path: "/admin/tags", name: "Tags verwalten", icon: "mdi:tag-edit" },
  { path: "/admin/recipients", name: "Empfänger", icon: "mdi:person-edit" },
  {
    path: "/admin/planning",
    name: "Planungen verwalten",
    icon: "mdi:calendar-edit",
  },
  {
    path: "/admin/rules",
    name: "Regeln verwalten",
    icon: "mdi:lightning-bolt",
  },
  {
    path: "/admin/tenants",
    name: "Mandanten",
    icon: "mdi:office-building-cog",
  }, // <-- neu
  { path: "/settings", name: "Einstellungen", icon: "mdi:cog" },
];

const isActive = (path: string) => {
  return router.currentRoute.value.path === path;
};

const dropdownOpen = ref(false);
let openTimer: ReturnType<typeof setTimeout> | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;

function handleMouseEnter() {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  if (!dropdownOpen.value && !openTimer) {
    openTimer = setTimeout(() => {
      dropdownOpen.value = true;
      openTimer = null;
    }, 300);
  }
}

function handleMouseLeave() {
  if (openTimer) {
    clearTimeout(openTimer);
    openTimer = null;
  }
  if (dropdownOpen.value && !closeTimer) {
    closeTimer = setTimeout(() => {
      dropdownOpen.value = false;
      closeTimer = null;
    }, 300);
  }
}

function handleItemClick() {
  dropdownOpen.value = false;
  emit("closeMenu");
}

function clearAndReseedData() {
  if (confirm("Möchtest Du wirklich alle Daten löschen und neu laden?")) {
    const stores = [
      useAccountStore(),
      useCategoryStore(),
      useRecipientStore(),
      useTagStore(),
      useTransactionStore(),
      usePlanningStore(),
      useRuleStore(),
      useStatisticsStore(),
      useThemeStore(),
    ];
    stores.forEach((store) => {
      if (typeof store.reset === "function") store.reset();
    });
    clearData();
    seedData();
    router.push("/");
  }
}
</script>

<template>
  <template v-for="route in routes" :key="route.path">
    <li @click="$emit('closeMenu')">
      <router-link
        :to="route.path"
        :class="{
          active: isActive(route.path),
          'text-primary bg-primary/20': isActive(route.path),
        }"
        class="rounded-box"
      >
        <span class="flex items-center">
          <Icon class="mr-2 text-lg" :icon="route.icon" />
          {{ route.name }}
        </span>
      </router-link>
    </li>
  </template>

  <li
    class="dropdown dropdown-bottom dropdown-end"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <a tabindex="0" class="rounded-box cursor-default">
      <span class="flex items-center">
        <Icon class="mr-2 text-lg" icon="mdi:tools" />
        Administration
      </span>
    </a>
    <transition name="fade">
      <ul
        v-if="dropdownOpen"
        class="dropdown-content menu p-2 bg-base-100 border border-base-300 rounded-box"
      >
        <template v-for="route in adminRoutes" :key="route.path">
          <li @click="handleItemClick">
            <router-link
              :to="route.path"
              :class="{
                active: isActive(route.path),
                'text-primary bg-primary/20': isActive(route.path),
              }"
              class="rounded-box"
            >
              <span class="flex items-center w-50">
                <Icon class="mr-2 text-lg" :icon="route.icon" />
                {{ route.name }}
              </span>
            </router-link>
          </li>
        </template>
        <li>
          <button class="rounded-box" @click="clearAndReseedData">
            <span class="flex items-center">
              <Icon class="mr-2 text-lg" icon="mdi:database-refresh" />
              Daten löschen & neu laden
            </span>
          </button>
        </li>
      </ul>
    </transition>
  </li>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
