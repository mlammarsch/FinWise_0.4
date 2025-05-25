<!-- src/components/ui/SelectRecipient.vue -->
<script setup lang="ts">
/**
 * Pfad zur Komponente: src/components/ui/SelectRecipient.vue
 * Beschreibung: Generischer Empfänger-Select mit Suche und Neuanlage.
 *
 * Komponenten-Props:
 * - modelValue?: string - Bindung für v-model (Empfänger-ID)
 * - disabled?: boolean - Deaktiviert die Komponente
 *
 * Emits:
 * - update:modelValue (newRecipientId: string | undefined): Neue Empfänger-ID oder undefined
 * - select (selectedRecipientId: string | undefined): Empfänger-ID bei Auswahl oder undefined
 * - create (recipientData: { name: string }): Wird ausgelöst, wenn ein neuer Empfänger erstellt werden soll
 */
import { ref, computed, watch, onMounted, nextTick, defineExpose } from "vue";
import { useRecipientStore } from "@/stores/recipientStore";
import { debugLog } from "@/utils/logger";
import { Icon } from "@iconify/vue";

const props = defineProps<{
  modelValue?: string;
  disabled?: boolean;
}>();
const emit = defineEmits(["update:modelValue", "select", "create"]);

const recipientStore = useRecipientStore();

const searchTerm = ref("");
const dropdownOpen = ref(false);
const highlightedIndex = ref(-1);
const inputRef = ref<HTMLInputElement | null>(null);
const selected = ref(props.modelValue || "");

/**
 * Initialisiert den Suchbegriff basierend auf der ausgewählten Empfänger-ID beim Laden.
 */
onMounted(() => {
  if (selected.value) {
    const recipient = recipientStore.recipients.find(
      (r) => r.id === selected.value
    );
    if (recipient) {
      searchTerm.value = recipient.name;
      debugLog("[SelectRecipient] onMounted → set searchTerm", {
        id: recipient.id,
        name: recipient.name,
      });
    }
  }
});

/**
 * Synchronisiert den lokalen Zustand (selected, searchTerm) mit Änderungen der modelValue-Prop.
 */
watch(
  () => props.modelValue,
  (newVal) => {
    selected.value = newVal || "";
    const recipient = recipientStore.recipients.find((r) => r.id === newVal);
    if (recipient && searchTerm.value !== recipient.name) {
      searchTerm.value = recipient.name;
      debugLog("[SelectRecipient] watch:modelValue → set searchTerm", {
        id: recipient.id,
        name: recipient.name,
      });
    } else if (!newVal && searchTerm.value && !dropdownOpen.value) {
      // searchTerm.value = ""; // Behalte Text
    }
  }
);

/**
 * Stößt das 'update:modelValue'-Event an, wenn sich die interne Auswahl ändert.
 */
watch(selected, (newVal) => {
  debugLog("[SelectRecipient] watch:selected → emit update:modelValue", {
    newVal,
  });
  emit("update:modelValue", newVal || undefined);
  emit("select", newVal || undefined);
});

/**
 * Filtert die Empfängerliste basierend auf dem Suchbegriff.
 */
const filteredRecipients = computed(() => {
  if (searchTerm.value.trim()) {
    const term = searchTerm.value.toLowerCase();
    return recipientStore.recipients
      .filter((r) => r.name.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  return recipientStore.recipients.sort((a, b) => a.name.localeCompare(b.name));
});

/**
 * Bestimmt, ob die Option zum Erstellen eines neuen Empfängers angezeigt werden soll.
 */
const canCreateRecipient = computed(() => {
  if (props.disabled) return false;
  const term = searchTerm.value.trim();
  if (!term) return false;
  return !recipientStore.recipients.some(
    (r) => r.name.toLowerCase() === term.toLowerCase()
  );
});

/**
 * Berechnet die Gesamtzahl der Optionen im Dropdown (Empfänger + ggf. "Neu erstellen").
 */
const totalOptionsCount = computed(() => {
  return filteredRecipients.value.length + (canCreateRecipient.value ? 1 : 0);
});

/**
 * Behandelt Tastatureingaben im Suchfeld (Pfeiltasten, Enter, Escape).
 */
function onKeyDown(e: KeyboardEvent) {
  if (props.disabled) return;

  if (!dropdownOpen.value && !["Escape", "Tab"].includes(e.key)) {
    toggleDropdown();
    if (["ArrowDown", "ArrowUp", "Enter"].includes(e.key)) {
      e.preventDefault();
    }
    return;
  }

  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      if (highlightedIndex.value < totalOptionsCount.value - 1) {
        highlightedIndex.value++;
        scrollToHighlighted();
      }
      break;
    case "ArrowUp":
      e.preventDefault();
      if (highlightedIndex.value > 0) {
        highlightedIndex.value--;
        scrollToHighlighted();
      }
      break;
    case "Enter":
      e.preventDefault();
      if (
        highlightedIndex.value >= 0 &&
        highlightedIndex.value < filteredRecipients.value.length
      ) {
        selectRecipient(filteredRecipients.value[highlightedIndex.value]);
      } else if (
        highlightedIndex.value === filteredRecipients.value.length &&
        canCreateRecipient.value
      ) {
        createRecipient();
      } else if (
        canCreateRecipient.value &&
        filteredRecipients.value.length === 0
      ) {
        // Erlaube Erstellen auch ohne Highlight, wenn es die einzige Option ist
        createRecipient();
      }
      break;
    case "Escape":
      e.preventDefault();
      closeDropdown();
      break;
  }
}

/**
 * Scrollt die Dropdown-Liste, sodass die aktuell hervorgehobene Option sichtbar ist.
 */
function scrollToHighlighted() {
  let elementId = "";
  if (
    highlightedIndex.value >= 0 &&
    highlightedIndex.value < filteredRecipients.value.length
  ) {
    const option = filteredRecipients.value[highlightedIndex.value];
    if (option) {
      elementId = `select-recipient-option-${option.id}`;
    }
  } else if (
    highlightedIndex.value === filteredRecipients.value.length &&
    canCreateRecipient.value
  ) {
    elementId = "select-recipient-create-new";
  }

  if (elementId) {
    const el = document.getElementById(elementId);
    el?.scrollIntoView({ block: "nearest" });
  }
}

/**
 * Öffnet oder schließt das Dropdown-Menü. Setzt den Fokus und den Highlight-Index zurück beim Öffnen.
 */
function toggleDropdown() {
  if (props.disabled) return;
  dropdownOpen.value = !dropdownOpen.value;
  if (dropdownOpen.value) {
    highlightedIndex.value = -1;
    const currentSelectionIndex = filteredRecipients.value.findIndex(
      (r) => r.id === selected.value
    );
    if (currentSelectionIndex !== -1) {
      highlightedIndex.value = currentSelectionIndex;
    }
    nextTick(() => {
      // Fokus wird durch onFocus gesetzt
      if (highlightedIndex.value !== -1) {
        scrollToHighlighted();
      }
    });
  }
}

/**
 * Schließt das Dropdown-Menü und stellt ggf. den Suchtext wieder her.
 */
function closeDropdown() {
  dropdownOpen.value = false;
  highlightedIndex.value = -1;
  const currentRecipient = recipientStore.recipients.find(
    (r) => r.id === selected.value
  );
  if (currentRecipient && searchTerm.value !== currentRecipient.name) {
    searchTerm.value = currentRecipient.name;
  } else if (!selected.value) {
    // searchTerm.value = ""; // Behalte Text
  }
}

/**
 * Schließt das Dropdown verzögert, wenn der Fokus das Element verlässt.
 */
function onBlur(event: FocusEvent) {
  if (props.disabled) return;
  setTimeout(() => {
    const relatedTarget = event.relatedTarget as HTMLElement | null;
    // Prüfen ob der neue Fokus immer noch Teil der Komponente ist
    if (!relatedTarget || !relatedTarget.closest(".dropdown-container")) {
      closeDropdown();
    }
  }, 200);
}

/**
 * Markiert den gesamten Text im Inputfeld, wenn es den Fokus erhält, und öffnet ggf. das Dropdown.
 */
function onFocus(event: FocusEvent) {
  if (props.disabled) return;
  const target = event.target as HTMLInputElement;
  setTimeout(() => target.select(), 0);
  // Nur öffnen, wenn noch nicht offen
  if (!dropdownOpen.value) {
    toggleDropdown();
  }
}

/**
 * Wählt einen vorhandenen Empfänger aus, aktualisiert den Zustand und schließt das Dropdown.
 */
function selectRecipient(recipient: { id: string; name: string }) {
  if (props.disabled) return;
  debugLog("[SelectRecipient] selectRecipient", {
    id: recipient.id,
    name: recipient.name,
  });
  selected.value = recipient.id;
  searchTerm.value = recipient.name;
  closeDropdown();
  debugLog("[SelectRecipient] after selection", { selected: selected.value });
}

/**
 * Löst das 'create'-Event aus, um einen neuen Empfänger zu erstellen, und schließt das Dropdown.
 */
function createRecipient() {
  if (props.disabled || !canCreateRecipient.value) return;
  const name = searchTerm.value.trim();
  if (!name) return;
  emit("create", { name });
  debugLog("[SelectRecipient] createRecipient emitted", { name });
  closeDropdown(); // Schließen nach dem Emitten
}

/**
 * Löscht den Suchbegriff und die Auswahl, setzt den Fokus zurück auf das Inputfeld.
 */
function clearSearch() {
  if (props.disabled) return;
  searchTerm.value = "";
  selected.value = "";
  emit("update:modelValue", undefined);
  emit("select", undefined);
  inputRef.value?.focus();
  if (!dropdownOpen.value) {
    toggleDropdown();
  } else {
    highlightedIndex.value = -1;
  }
}

// Exponiert die focusInput Methode nach außen
function focusInput() {
  inputRef.value?.focus();
}
defineExpose({ focusInput });
</script>

<template>
  <div class="relative dropdown-container">
    <!-- Input Feld mit Suchfunktion -->
    <div class="relative">
      <input
        ref="inputRef"
        type="text"
        class="input input-bordered w-full pr-8"
        :class="{ 'input-disabled opacity-70 cursor-not-allowed': disabled }"
        v-model="searchTerm"
        @input="
          dropdownOpen = true;
          highlightedIndex = -1;
        "
        @keydown="onKeyDown"
        @focus="onFocus"
        @blur="onBlur"
        :disabled="disabled"
        placeholder="Empfänger suchen oder erstellen..."
        autocomplete="off"
      />
      <!-- Löschen Button -->
      <button
        type="button"
        v-if="searchTerm && !disabled"
        @mousedown.prevent="clearSearch"
        class="absolute right-2 top-1/2 transform -translate-y-1/2 text-base text-neutral/60 hover:text-error/60 btn btn-ghost btn-xs btn-circle"
        aria-label="Suche löschen"
      >
        <Icon icon="mdi:close-circle-outline" />
      </button>
      <!-- Chevron Icon entfernt -->
    </div>
    <!-- Dropdown Liste -->
    <div
      v-if="dropdownOpen && !disabled"
      class="absolute z-40 w-full bg-base-100 border border-base-300 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-lg dropdown-container"
      role="listbox"
    >
      <!-- Meldung, wenn keine Ergebnisse und keine Neuanlage möglich -->
      <div
        v-if="filteredRecipients.length === 0 && !canCreateRecipient"
        class="px-3 py-1.5 text-sm text-base-content/60 italic"
      >
        Keine Empfänger gefunden.
      </div>

      <!-- Liste der gefilterten Empfänger -->
      <template v-else>
        <div
          v-for="(recipient, idx) in filteredRecipients"
          :id="'select-recipient-option-' + recipient.id"
          :key="recipient.id"
          class="px-3 py-1.5 text-sm cursor-pointer hover:bg-base-200"
          :class="{
            'bg-base-300': idx === highlightedIndex, // Hervorhebung Tastatur
            'font-medium': recipient.id === selected, // Hervorhebung Auswahl
          }"
          @mousedown.prevent="selectRecipient(recipient)"
          role="option"
          :aria-selected="recipient.id === selected"
        >
          {{ recipient.name }}
        </div>

        <!-- Option zum Erstellen eines neuen Empfängers -->
        <div
          v-if="canCreateRecipient"
          id="select-recipient-create-new"
          class="px-3 py-1.5 text-sm cursor-pointer hover:bg-base-200 border-t border-base-300 flex items-center gap-2"
          :class="{
            'bg-base-300': highlightedIndex === filteredRecipients.length,
          }"
          @mousedown.prevent="createRecipient"
          role="option"
          aria-selected="false"
        >
          <Icon icon="mdi:plus-circle-outline" class="text-lg" />
          <span>"{{ searchTerm }}" erstellen</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* Stellt sicher, dass deaktivierte Inputs wirklich ausgegraut wirken */
.input-disabled {
  background-color: hsl(var(--b2) / 0.5);
  border-color: hsl(var(--b3));
}
/* Verhindert Autocomplete-Überlagerung */
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus,
input:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0 30px hsl(var(--b1)) inset !important;
  background-color: hsl(var(--b1)) !important;
  background-image: none !important;
  color: hsl(var(--bc)) !important;
}
</style>
