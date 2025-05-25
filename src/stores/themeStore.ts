import { defineStore } from "pinia";
import { ref, watch } from "vue";

export const useThemeStore = defineStore("theme", () => {
  const isDarkMode = ref(false);

  function initTheme() {
    const savedTheme = localStorage.getItem("theme");

    if (savedTheme) {
      isDarkMode.value = savedTheme === "dark";
    } else {
      isDarkMode.value = window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    applyTheme();
  }

  function toggleTheme() {
    isDarkMode.value = !isDarkMode.value;
    localStorage.setItem("theme", isDarkMode.value ? "dark" : "light");
    applyTheme();
  }

  function applyTheme() {
    const theme = isDarkMode.value ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
  }

  watch(isDarkMode, () => {
    applyTheme();
  });

  function reset() {
    isDarkMode.value = false;
    initTheme();
  }

  return {
    isDarkMode,
    initTheme,
    toggleTheme,
    applyTheme,
    reset
  };
});
