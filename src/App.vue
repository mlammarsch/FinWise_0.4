<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import AppLayout from "./layouts/AppLayout.vue";
import { useThemeStore } from "./stores/themeStore";
import { useSessionStore } from "./stores/sessionStore";
import AccountCard from "./components/account/AccountCard.vue";

const themeStore = useThemeStore();
const router = useRouter();
const route = useRoute();
const session = useSessionStore();

// Initialize the application and load saved data
onMounted(() => {
  // Load the stored theme settings
  themeStore.initTheme();
});
</script>

<template>
  <AppLayout>
    <Suspense>
      <template #default>
        <router-view v-slot="{ Component }">
          <component
            v-if="Component"
            :is="Component"
            :key="`${route.name}-${session.currentTenantId}`"
          />
        </router-view>
      </template>
      <template #fallback>
        <div class="p-4 text-center">Loading...</div>
      </template>
    </Suspense>
  </AppLayout>
</template>
