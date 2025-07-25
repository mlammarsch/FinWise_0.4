<!-- src/components/ui/RecipientBulkActionDropdown.vue -->
<script setup lang="ts">
/**
 * Pfad zur Komponente: src/components/ui/RecipientBulkActionDropdown.vue
 * Dropdown-Menü für Massenbearbeitungsaktionen in Empfänger-Listen
 *
 * Props:
 * - selectedCount: number - Anzahl der ausgewählten Empfänger
 * - disabled?: boolean - Deaktiviert das Dropdown
 *
 * Emits:
 * - merge-recipients: Empfänger zusammenführen
 * - delete-recipients: Empfänger löschen
 */
import { ref, onMounted, onUnmounted } from "vue";
import { Icon } from "@iconify/vue";

const props = defineProps<{
  selectedCount: number;
  disabled?: boolean;
}>();

const emit = defineEmits(["merge-recipients", "delete-recipients"]);

const isDropdownOpen = ref(false);
const dropdownButtonRef = ref<HTMLButtonElement | null>(null);
const menuRef = ref<HTMLUListElement | null>(null);
const menuStyle = ref({});

function openDropdown() {
  if (props.disabled || props.selectedCount === 0) return;

  if (!dropdownButtonRef.value) return;
  const rect = dropdownButtonRef.value.getBoundingClientRect();
  menuStyle.value = {
    position: "fixed",
    top: `${rect.bottom}px`,
    left: `${rect.right}px`,
    transform: "translateX(-100%)",
    zIndex: 5000,
  };
  isDropdownOpen.value = true;
}

function closeDropdown() {
  isDropdownOpen.value = false;
}

function toggleDropdown() {
  if (isDropdownOpen.value) {
    closeDropdown();
  } else {
    openDropdown();
  }
}

function handleClickOutside(event: MouseEvent) {
  if (
    (menuRef.value && menuRef.value.contains(event.target as Node)) ||
    (dropdownButtonRef.value &&
      dropdownButtonRef.value.contains(event.target as Node))
  ) {
    return;
  }
  closeDropdown();
}

function handleAction(action: string) {
  emit(action as any);
  closeDropdown();
}

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>

<template>
  <div class="relative">
    <!-- Hamburger Button -->
    <button
      ref="dropdownButtonRef"
      @click.stop="toggleDropdown"
      class="btn btn-sm btn-ghost btn-circle"
      :class="{
        'btn-disabled opacity-50': disabled || selectedCount === 0,
      }"
      :disabled="disabled || selectedCount === 0"
      :title="
        selectedCount > 0
          ? `${selectedCount} Empfänger ausgewählt`
          : 'Keine Empfänger ausgewählt'
      "
    >
      <div class="relative">
        <Icon
          icon="mdi:menu"
          class="text-xl"
        />
        <span
          v-if="selectedCount > 0"
          class="absolute -top-2 -right-2 badge badge-primary badge-xs"
        >
          {{ selectedCount }}
        </span>
      </div>
    </button>

    <!-- Dropdown Menu -->
    <Teleport to="body">
      <ul
        v-if="isDropdownOpen"
        ref="menuRef"
        :style="menuStyle"
        class="menu p-2 shadow bg-base-100 border border-base-300 rounded-box w-56"
      >
        <!-- Überschrift -->
        <li class="menu-title">
          <span>Massenbearbeitung</span>
        </li>

        <!-- Empfänger zusammenführen -->
        <li>
          <a @click="handleAction('merge-recipients')">
            <Icon
              icon="mdi:merge"
              class="text-lg"
            />
            Empfänger zusammenführen
          </a>
        </li>
      </ul>
    </Teleport>
  </div>
</template>
