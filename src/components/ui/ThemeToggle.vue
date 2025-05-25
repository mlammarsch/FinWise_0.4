<script setup lang="ts">
import { useThemeStore } from "../../stores/themeStore";
import { Icon } from "@iconify/vue";
import { onMounted } from "vue";

const themeStore = useThemeStore();

// Initialize the Theme when the Componenet is mounted
onMounted(() => {
  themeStore.initTheme();
});

const toggleTheme = () => {
  themeStore.toggleTheme();
};
</script>

<template>
  <button @click="toggleTheme" class="btn btn-ghost btn-circle">
    <Icon
      v-if="themeStore.isDarkMode"
      icon="mdi:weather-sunny"
      class="text-xl"
    />
    <Icon v-else icon="mdi:weather-night" class="text-xl" />
  </button>
</template>
