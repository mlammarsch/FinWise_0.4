<!-- src/components/ui/BulkActionDropdown.vue -->
<script setup lang="ts">
/**
 * Pfad zur Komponente: src/components/ui/BulkActionDropdown.vue
 * Dropdown-Menü für Massenbearbeitungsaktionen in Transaktionslisten
 *
 * Props:
 * - selectedCount: number - Anzahl der ausgewählten Transaktionen
 * - disabled?: boolean - Deaktiviert das Dropdown
 *
 * Emits:
 * - assign-account: Kontozuweisung
 * - change-recipient: Empfänger ändern
 * - assign-category: Kategorienzuweisung
 * - assign-tags: Tags zuweisen
 * - change-date: Datum ändern
 * - set-reconciled: Abgleich aktivieren
 * - remove-reconciled: Abgleich entfernen
 * - delete: Löschen
 */
import { ref, onMounted, onUnmounted } from "vue";
import { Icon } from "@iconify/vue";

const props = defineProps<{
  selectedCount: number;
  disabled?: boolean;
}>();

const emit = defineEmits([
  "assign-account",
  "change-recipient",
  "assign-category",
  "assign-tags",
  "change-date",
  "set-reconciled",
  "remove-reconciled",
  "delete",
]);

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
          ? `${selectedCount} Transaktionen ausgewählt`
          : 'Keine Transaktionen ausgewählt'
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
          <span>Massenänderung</span>
        </li>

        <!-- Kontozuweisung -->
        <li>
          <a @click="handleAction('assign-account')">
            <Icon
              icon="mdi:bank"
              class="text-lg"
            />
            Kontozuweisung
          </a>
        </li>

        <!-- Empfänger ändern -->
        <li>
          <a @click="handleAction('change-recipient')">
            <Icon
              icon="mdi:account"
              class="text-lg"
            />
            Empfänger ändern
          </a>
        </li>

        <!-- Kategorienzuweisung -->
        <li>
          <a @click="handleAction('assign-category')">
            <Icon
              icon="mdi:folder"
              class="text-lg"
            />
            Kategorienzuweisung
          </a>
        </li>

        <!-- Tags zuweisen -->
        <li>
          <a @click="handleAction('assign-tags')">
            <Icon
              icon="mdi:tag-multiple"
              class="text-lg"
            />
            Tags zuweisen
          </a>
        </li>

        <!-- Datum ändern -->
        <li>
          <a @click="handleAction('change-date')">
            <Icon
              icon="mdi:calendar"
              class="text-lg"
            />
            Datum ändern
          </a>
        </li>

        <li class="divider"></li>

        <!-- Abgleich aktivieren -->
        <li>
          <a @click="handleAction('set-reconciled')">
            <Icon
              icon="mdi:check-circle"
              class="text-lg"
            />
            Alle markierte abgleichen
          </a>
        </li>

        <!-- Abgleich entfernen -->
        <li>
          <a @click="handleAction('remove-reconciled')">
            <Icon
              icon="mdi:close-circle"
              class="text-lg"
            />
            Abgleich entfernen
          </a>
        </li>

        <li class="divider"></li>

        <!-- Löschen -->
        <li>
          <a
            @click="handleAction('delete')"
            class="text-error"
          >
            <Icon
              icon="mdi:trash-can"
              class="text-lg"
            />
            Löschen
          </a>
        </li>
      </ul>
    </Teleport>
  </div>
</template>
