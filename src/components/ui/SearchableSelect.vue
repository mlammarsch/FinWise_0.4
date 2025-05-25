<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { Icon } from "@iconify/vue";
import { v4 as uuidv4 } from "uuid";

const props = defineProps<{
  modelValue: string | string[] | null;
  options: Array<{ id: string; name: string }>;
  label?: string;
  placeholder?: string;
  multiple?: boolean;
  allowCreate?: boolean;
  required?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits(["update:modelValue", "create"]);

const searchTerm = ref("");
const isOpen = ref(false);

// Stelle sicher, dass modelValue nie null ist
const selectedValue = computed({
  get: () =>
    props.modelValue !== null ? props.modelValue : props.multiple ? [] : "",
  set: (val) => emit("update:modelValue", val),
});

// Gefilterte Optionen: bereits ausgewählte Werte werden ausgeblendet und alphabetisch sortiert.
const filteredOptions = computed(() => {
  let base = props.options;
  if (props.multiple) {
    base = base.filter(
      (option) => !(selectedValue.value as string[]).includes(option.id)
    );
  } else if (selectedValue.value) {
    base = base.filter((option) => option.id !== selectedValue.value);
  }
  if (searchTerm.value) {
    const term = searchTerm.value.toLowerCase();
    base = base.filter((option) => option.name.toLowerCase().includes(term));
  }
  return base.sort((a, b) => a.name.localeCompare(b.name));
});

// Computed: Prüfe, ob eine neue Option erstellt werden kann
const canCreate = computed(() => {
  if (!props.allowCreate) return false;
  const term = searchTerm.value.trim().toLowerCase();
  if (!term) return false;
  return !props.options.some((option) => option.name.toLowerCase() === term);
});

// Prüfe, ob eine Option ausgewählt ist
const isSelected = (id: string) => {
  return props.multiple
    ? (selectedValue.value as string[]).includes(id)
    : selectedValue.value === id;
};

// Wähle eine Option aus oder entferne sie
const toggleOption = (id: string) => {
  if (props.disabled) return;
  if (props.multiple) {
    const current = [...(selectedValue.value as string[])];
    const idx = current.indexOf(id);
    if (idx === -1) {
      current.push(id);
    } else {
      current.splice(idx, 1);
    }
    selectedValue.value = current;
  } else {
    selectedValue.value = id;
    isOpen.value = false;
  }
  searchTerm.value = "";
};

// Erstellt eine neue Option und gibt sie an den Parent weiter
function createOption() {
  if (!searchTerm.value.trim() || !props.allowCreate) return;
  const newOption = { name: searchTerm.value.trim() };
  emit("create", newOption);
  searchTerm.value = "";
  isOpen.value = false;
}

// Wird beim Drücken der Enter-Taste ausgelöst
function onEnter() {
  if (canCreate.value) {
    createOption();
  }
}

// Zeige den Namen der ausgewählten Option(en)
const selectedDisplay = computed(() => {
  if (props.multiple) {
    const selectedOpts = props.options.filter((option) =>
      (selectedValue.value as string[]).includes(option.id)
    );
    if (selectedOpts.length === 0) return "";
    if (selectedOpts.length === 1) return selectedOpts[0].name;
    return `${selectedOpts.length} ausgewählt`;
  } else {
    return (
      props.options.find((option) => option.id === selectedValue.value)?.name ||
      ""
    );
  }
});

// Schließt das Dropdown, wenn außerhalb geklickt wird
const closeDropdown = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (!target.closest(".custom-select")) {
    isOpen.value = false;
  }
};

// Event-Listener an/abmelden
watch(isOpen, (newValue) => {
  if (newValue) {
    setTimeout(() => {
      window.addEventListener("click", closeDropdown);
    }, 0);
  } else {
    window.removeEventListener("click", closeDropdown);
  }
});
</script>

<template>
  <div class="form-control w-full custom-select relative">
    <!-- Label für das Dropdown -->
    <label v-if="label" class="label">
      <span class="label-text">{{ label }}</span>
      <span v-if="required" class="text-error">*</span>
    </label>

    <div class="relative">
      <!-- Hauptbereich der Auswahl -->
      <div
        class="input input-bordered w-full flex items-center justify-between cursor-pointer"
        :class="{ 'opacity-70': disabled }"
        @click="isOpen = !disabled && !isOpen"
      >
        <span v-if="selectedDisplay" class="truncate">{{
          selectedDisplay
        }}</span>
        <span v-else class="text-base-content/50">{{
          placeholder || "Auswählen..."
        }}</span>
        <Icon icon="mdi:arrow-down-drop" class="ml-2 text-lg" />
      </div>

      <!-- Dropdown mit Optionen -->
      <div
        v-if="isOpen"
        class="mt-1 w-full bg-base-100 rounded-box shadow-lg border border-base-300 absolute z-40"
      >
        <!-- Suchfeld -->
        <div class="px-2 pt-2">
          <input
            type="text"
            class="input input-sm input-bordered border-base-300 w-full"
            v-model="searchTerm"
            placeholder="Suchen oder neu anlegen..."
            @click.stop
            @keydown.enter="onEnter"
          />
        </div>

        <!-- Liste der Optionen -->
        <ul class="max-h-60 overflow-y-auto p-2">
          <li
            v-for="option in filteredOptions"
            :key="option.id"
            class=""
            @click="toggleOption(option.id)"
          >
            <label
              class="flex items-center space-x-2 cursor-pointer hover:bg-base-200 rounded-lg p-1"
            >
              <span>{{ option.name }}</span>
            </label>
          </li>
          <!-- Keine Ergebnisse oder Option erstellen -->
          <li v-if="filteredOptions.length === 0 && searchTerm" class="">
            <div
              v-if="allowCreate"
              class="p-2 hover:bg-base-200 rounded-lg cursor-pointer"
              @click="createOption"
            >
              <span
                class="flex items-center hover:bg-base-300 bg-base-200 rounded-lg p-1"
              >
                <Icon icon="mdi:plus-circle" class="mr-2 text-lg" />
                "{{ searchTerm }}" erstellen
              </span>
            </div>
            <div v-else class="p-2 text-base-content/50">
              Keine Ergebnisse gefunden
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
