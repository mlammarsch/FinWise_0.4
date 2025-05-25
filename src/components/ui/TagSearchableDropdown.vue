<script setup lang="ts">
/**
 * Pfad zur Komponente: src/components/ui/TagSearchableDropdown.vue
 * Kurze Beschreibung: Ermöglicht das Suchen, Erstellen und Auswählen mehrerer Tags.
 * Komponenten-Props:
 * - modelValue: string[] - Die IDs der ausgewählten Tags.
 * - options: Array<{ id: string; name: string; color?: string }> - Liste aller verfügbaren Tags.
 * - placeholder?: string - Platzhaltertext, wenn keine Tags ausgewählt sind.
 * - disabled?: boolean - Deaktiviert die Auswahl.
 * - label?: string - Label der Komponente.
 *
 * Emits:
 * - update:modelValue - Wird ausgelöst, wenn sich die Auswahl ändert.
 * - create - Wird ausgelöst, wenn ein neuer Tag erstellt werden soll.
 */
import { ref, computed, watch, nextTick } from "vue";
import { Icon } from "@iconify/vue";
import { v4 as uuidv4 } from "uuid";

interface TagOption {
  id: string;
  name: string;
  color?: string;
}

const props = defineProps<{
  modelValue: string[];
  options: Array<TagOption>;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
}>();

const emit = defineEmits(["update:modelValue", "create"]);

// Ausgewählte Tag-IDs
const selectedTags = computed({
  get: () => props.modelValue || [],
  set: (val: string[]) => emit("update:modelValue", val),
});

// Hilfsfunktion zum Suchen einer Option anhand der Tag-ID
function getTagOption(tagId: string): TagOption | undefined {
  return props.options.find((option) => option.id === tagId);
}

// Suchfeld und Dropdown-Status
const searchTerm = ref("");
const isOpen = ref(false);

// Gefilterte Optionen basierend auf dem Suchbegriff,
// es werden bereits ausgewählte Tags nicht angezeigt und alphabetisch sortiert.
const filteredOptions = computed(() => {
  let opts = props.options.filter(
    (opt) => !selectedTags.value.includes(opt.id)
  );
  if (searchTerm.value) {
    const term = searchTerm.value.toLowerCase();
    opts = opts.filter((opt) => opt.name.toLowerCase().includes(term));
  }
  return opts.sort((a, b) => a.name.localeCompare(b.name));
});

// Erlaubt das Anlegen eines neuen Tags, wenn der Suchbegriff nicht exakt existiert
const canCreate = computed(() => {
  const term = searchTerm.value.trim().toLowerCase();
  if (!term) return false;
  return !props.options.some((opt) => opt.name.toLowerCase() === term);
});

// Fügt einen Tag in die Auswahl ein
function addTag(tagId: string) {
  if (props.disabled) return;
  if (!selectedTags.value.includes(tagId)) {
    selectedTags.value = [...selectedTags.value, tagId];
  }
  searchTerm.value = "";
  isOpen.value = false;
}

// Entfernt einen Tag aus der Auswahl
function removeTag(tagId: string) {
  selectedTags.value = selectedTags.value.filter((id) => id !== tagId);
}

// Erstellt eine neue Option und gibt sie an den Parent weiter
function createOption() {
  const val = searchTerm.value.trim();
  if (!val) return;
  emit("create", { name: val });
  searchTerm.value = "";
  isOpen.value = false;
}

// Löst beim Drücken der Enter-Taste den Create-Flow aus
function onEnter() {
  if (canCreate.value) {
    createOption();
  }
}

// Öffnet/Schließt das Dropdown
function toggleDropdown() {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    nextTick(() => {
      const input = document.getElementById(
        "tag-search-input"
      ) as HTMLInputElement | null;
      if (input) input.focus();
    });
  }
}

// Schließt das Dropdown, wenn außerhalb geklickt wird
function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!target.closest(".tag-search-dropdown-container")) {
    isOpen.value = false;
  }
}

// Event-Listener an/abmelden
watch(isOpen, (val) => {
  if (val) {
    window.addEventListener("click", handleClickOutside);
  } else {
    window.removeEventListener("click", handleClickOutside);
  }
});
</script>

<template>
  <!-- Hauptcontainer -->
  <div
    class="form-control w-full tag-search-dropdown-container relative"
    style="position: relative"
  >
    <!-- Label -->
    <label v-if="label" class="label">
      <span class="label-text">{{ label }}</span>
    </label>

    <!-- Ausgewählte Tags als Badges -->
    <div class="flex flex-wrap items-center gap-1 mb-0 border rounded-lg p-2">
      <span
        v-for="tagId in selectedTags"
        :key="tagId"
        class="badge badge-sm rounded-full flex items-center gap-1"
        :class="{
          'badge-secondary': !getTagOption(tagId)?.color,
          'text-white': getTagOption(tagId)?.color,
        }"
        :style="
          getTagOption(tagId)?.color
            ? { backgroundColor: getTagOption(tagId).color }
            : {}
        "
      >
        <span>{{ getTagOption(tagId)?.name || tagId }}</span>
        <button
          type="button"
          class="btn btn-ghost btn-xs text-neutral p-0"
          @click.prevent="removeTag(tagId)"
        >
          <Icon icon="mdi:close" class="text-sm" />
        </button>
      </span>
      <!-- Button zum Hinzufügen neuer Tags -->
      <div
        class="cursor-pointer text-base-content/50 flex items-center"
        :class="{ 'opacity-50': disabled }"
        @click.stop="toggleDropdown"
      >
        <span>{{ placeholder || "" }}</span>
        <Icon icon="mdi:plus-circle" class="text-lg" />
      </div>
    </div>

    <!-- Dropdown-Liste -->
    <div
      v-if="isOpen"
      class="bg-base-100 border border-base-300 rounded-box shadow-lg p-2 w-72 absolute z-40"
    >
      <!-- Suchfeld -->
      <input
        id="tag-search-input"
        class="input input-sm border-base-300 w-full mb-1"
        type="text"
        v-model="searchTerm"
        placeholder="Suchen oder neu anlegen..."
        @click.stop
        @keydown.enter="onEnter"
      />
      <!-- Gefilterte Optionen -->
      <ul class="max-h-60 overflow-y-auto">
        <li
          v-for="option in filteredOptions"
          :key="option.id"
          class="p-1 px-2 hover:bg-base-200 rounded-lg cursor-pointer"
          @click.stop="addTag(option.id)"
        >
          {{ option.name }}
        </li>
      </ul>
      <!-- Neue Option erstellen -->
      <div
        v-if="canCreate"
        class="py-1 px-2 hover:bg-base-300 bg-base-200 rounded-lg cursor-pointer flex items-center justify-left"
        @click.stop="createOption"
      >
        <Icon icon="mdi:plus" class="text-md mr-1" />
        <div>"{{ searchTerm }}" neu anlegen</div>
      </div>
    </div>
  </div>
</template>
