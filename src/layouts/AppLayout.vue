<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useThemeStore } from "../stores/themeStore";
import MainNavigation from "../components/ui/MainNavigation.vue";
import ThemeToggle from "../components/ui/ThemeToggle.vue";
import { Icon } from "@iconify/vue";
import TenantSwitch from "@/components/ui/TenantSwitch.vue";

const router = useRouter();
const themeStore = useThemeStore();
const isMobileMenuOpen = ref(false);

/* Sichtbarkeit Navigation – ausgeblendet bei hideNav-Routen */
const showNavigation = computed(() => !router.currentRoute.value.meta?.hideNav);

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value;
};
</script>

<template>
  <div class="min-h-screen flex flex-col bg-gradient relative">
    <div class="absolute inset-0 bg-base-100/95 backdrop-blur-md"></div>

    <!-- Header -->
    <header class="bg-base-100 sticky top-0 z-40 border-b border-base-300">
      <div class="navbar container mx-auto">
        <div class="navbar-start">
          <template v-if="showNavigation">
            <div class="dropdown">
              <button class="btn btn-ghost lg:hidden" @click="toggleMobileMenu">
                <Icon icon="mdi:menu" class="h-5 w-5" />
              </button>
              <ul
                v-if="isMobileMenuOpen"
                class="menu menu-sm dropdown-content mt-3 p-2 shadow bg-base-100 rounded-box w-52"
              >
                <MainNavigation @close-menu="isMobileMenuOpen = false" />
              </ul>
            </div>
          </template>
          <div class="flex normal-case text-2xl p-3">
            <div
              class="text-primary font-normal"
              style="font-family: 'Lobster', cursive"
            >
              Fin
            </div>
            <div
              class="text-secondary font-normal"
              style="font-family: 'Lobster Two', cursive"
            >
              Wise
            </div>
          </div>
        </div>

        <div v-if="showNavigation" class="navbar-center hidden lg:flex p-2">
          <ul class="menu menu-md menu-horizontal">
            <MainNavigation />
          </ul>
        </div>

        <div class="navbar-end p-3">
          <TenantSwitch v-if="showNavigation" />
          <ThemeToggle />
        </div>
      </div>
    </header>

    <!-- Hauptinhalt -->
    <main
      class="flex-grow overflow-y-auto container mx-auto px-4 py-6 relative"
    >
      <slot></slot>
    </main>

    <!-- Footer -->
    <footer
      class="bg-base-100 sticky bottom-0 z-40 border-t border-base-300 footer footer-center p-4 glass-effect"
    >
      <div>
        <p>
          © {{ new Date().getFullYear() }} - FinWise - Dein smarter
          Finanzassistent
        </p>
      </div>
    </footer>
  </div>
</template>
