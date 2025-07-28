<!-- src/components/ui/InfoToast.vue -->
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { Icon } from "@iconify/vue";

/**
 * Pfad zur Komponente: src/components/ui/InfoToast.vue
 * Ein Info-Toast für Benachrichtigungen unten links.
 *
 * Komponenten-Props:
 * - message: string – Die anzuzeigende Nachricht
 * - type?: 'success' | 'error' | 'info' | 'warning' – Toast-Typ (default: 'info')
 * - duration?: number – Anzeigedauer in ms (default: 4000)
 * - autoHide?: boolean – Automatisches Ausblenden (default: true)
 *
 * Emits:
 * - close – wird ausgelöst, wenn der Toast geschlossen wird
 */

const props = withDefaults(
  defineProps<{
    message: string;
    type?: "success" | "error" | "info" | "warning";
    duration?: number;
    autoHide?: boolean;
  }>(),
  {
    type: "info",
    duration: 4000,
    autoHide: true,
  }
);

const emit = defineEmits<{
  (e: "close"): void;
}>();

const isVisible = ref(true);

function close() {
  isVisible.value = false;
  emit("close");
}

function getToastClasses() {
  const baseClasses = "alert shadow-lg border-2 max-w-md";
  switch (props.type) {
    case "success":
      return `${baseClasses} alert-success border-success`;
    case "error":
      return `${baseClasses} alert-error border-error`;
    case "warning":
      return `${baseClasses} alert-warning border-warning`;
    case "info":
    default:
      return `${baseClasses} alert-info border-info`;
  }
}

function getIcon() {
  switch (props.type) {
    case "success":
      return "mdi:check-circle";
    case "error":
      return "mdi:alert-circle";
    case "warning":
      return "mdi:alert";
    case "info":
    default:
      return "mdi:information";
  }
}

onMounted(() => {
  if (props.autoHide) {
    setTimeout(() => {
      close();
    }, props.duration);
  }
});
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="transform translate-x-full opacity-0"
    enter-to-class="transform translate-x-0 opacity-100"
    leave-active-class="transition-all duration-300 ease-in"
    leave-from-class="transform translate-x-0 opacity-100"
    leave-to-class="transform translate-x-full opacity-0"
  >
    <div
      v-if="isVisible"
      class="fixed bottom-4 left-4 z-50"
    >
      <div :class="getToastClasses()">
        <div class="flex items-center">
          <Icon
            :icon="getIcon()"
            class="text-xl mr-3 flex-shrink-0"
          />
          <span class="flex-1">{{ message }}</span>
          <button
            class="btn btn-ghost btn-xs ml-2"
            @click="close"
          >
            <Icon
              icon="mdi:close"
              class="text-lg"
            />
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
