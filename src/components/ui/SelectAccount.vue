// src/components/ui/SelectAccount.vue
<script setup lang="ts">
/**
 * Pfad zur Komponente: src/components/ui/SelectAccount.vue
 * Beschreibung: Generischer Konto-Select mit Suche und Gruppierung nach Accountgruppen.
 * Komponenten-Props:
 * - modelValue?: string - Bindung für v-model (Konto-ID)
 *
 * Emits:
 * - update:modelValue (newAccountId: string | undefined): Neue Konto-ID oder undefined
 * - select (selectedAccountId: string | undefined): Konto-ID bei Auswahl oder undefined
 */
import { ref, computed, watch, onMounted, defineExpose, nextTick } from "vue";
import { useAccountStore } from "@/stores/accountStore";
import CurrencyDisplay from "./CurrencyDisplay.vue";
import { debugLog } from "@/utils/logger";
import { Icon } from "@iconify/vue";
import { AccountService } from "@/services/AccountService";

const props = defineProps<{
  modelValue?: string;
}>();
const emit = defineEmits(["update:modelValue", "select"]);

const accountStore = useAccountStore();

const searchTerm = ref("");
const dropdownOpen = ref(false);
const highlightedIndex = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);
const selected = ref(props.modelValue || "");

/**
 * Initialisiert den Suchbegriff basierend auf der ausgewählten Konto-ID beim Laden.
 */
onMounted(() => {
  if (selected.value) {
    const acc = accountStore.accounts.find((a) => a.id === selected.value);
    if (acc) {
      searchTerm.value = acc.name;
      debugLog("[SelectAccount] onMounted → set searchTerm", {
        id: acc.id,
        name: acc.name,
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
    const acc = accountStore.accounts.find((a) => a.id === newVal);
    if (acc && searchTerm.value !== acc.name) {
      searchTerm.value = acc.name;
      debugLog("[SelectAccount] watch:modelValue → set searchTerm", {
        id: acc.id,
        name: acc.name,
      });
    } else if (!newVal && searchTerm.value && !dropdownOpen.value) {
      // searchTerm.value = ""; // Deaktiviert, um Text bei versehentlichem Schließen zu behalten
    }
  }
);

/**
 * Stößt das 'update:modelValue'-Event an, wenn sich die interne Auswahl ändert.
 */
watch(selected, (newVal) => {
  debugLog("[SelectAccount] watch:selected → emit update:modelValue", {
    newVal,
  });
  emit("update:modelValue", newVal || undefined);
  emit("select", newVal || undefined);
});

interface Option {
  isHeader: boolean;
  headerText?: string;
  account?: (typeof accountStore.accounts)[0];
}

/**
 * Berechnet alle verfügbaren Optionen, inklusive Header für Kontogruppen.
 */
const options = computed<Option[]>(() => {
  const opts: Option[] = [];
  accountStore.accountGroups.forEach((group) => {
    const groupAccounts = accountStore.accounts
      .filter((acc) => acc.accountGroupId === group.id && acc.isActive)
      .sort((a, b) => a.name.localeCompare(b.name)); // Sortieren innerhalb der Gruppe
    if (groupAccounts.length) {
      opts.push({ isHeader: true, headerText: group.name });
      groupAccounts.forEach((acc) =>
        opts.push({ isHeader: false, account: acc })
      );
    }
  });
  const ungroupped = accountStore.accounts
    .filter((acc) => !acc.accountGroupId && acc.isActive)
    .sort((a, b) => a.name.localeCompare(b.name)); // Sortieren der ungruppierten
  if (ungroupped.length) {
    // Header nur anzeigen, wenn es auch gruppierte Konten gibt, oder wenn explizit gewünscht
    if (opts.length > 0 || ungroupped.length === accountStore.accounts.length) {
      opts.push({ isHeader: true, headerText: "Andere Konten" });
    }
    ungroupped.forEach((acc) => opts.push({ isHeader: false, account: acc }));
  }
  return opts;
});

/**
 * Filtert die Optionen basierend auf dem Suchbegriff und ob das Dropdown offen ist.
 */
const visibleOptions = computed<Option[]>(() => {
  if (!dropdownOpen.value) return [];
  if (searchTerm.value.trim()) {
    const term = searchTerm.value.toLowerCase();
    return options.value.filter((opt) =>
      opt.isHeader ? false : opt.account!.name.toLowerCase().includes(term)
    );
  }
  return options.value;
});

/**
 * Gibt nur die tatsächlichen Konto-Optionen (keine Header) zurück, die sichtbar sind.
 */
const nonHeaderOptions = computed(() =>
  visibleOptions.value.filter((opt) => !opt.isHeader)
);

/**
 * Gibt das aktuell durch Tastatur oder Maus hervorgehobene Konto zurück.
 */
const highlightedOption = computed(
  () => nonHeaderOptions.value[highlightedIndex.value]?.account
);

/**
 * Behandelt Tastatureingaben im Suchfeld (Pfeiltasten, Enter, Escape).
 */
function onKeyDown(e: KeyboardEvent) {
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
      if (highlightedIndex.value < nonHeaderOptions.value.length - 1) {
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
      const acc = highlightedOption.value;
      if (acc) selectAccount(acc);
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
  const acc = highlightedOption.value;
  if (acc) {
    const el = document.getElementById(`select-account-option-${acc.id}`);
    el?.scrollIntoView({ block: "nearest" });
  }
}

/**
 * Öffnet oder schließt das Dropdown-Menü. Setzt den Fokus und den Highlight-Index zurück beim Öffnen.
 */
function toggleDropdown() {
  dropdownOpen.value = !dropdownOpen.value;
  if (dropdownOpen.value) {
    highlightedIndex.value = 0;
    const currentSelectionIndex = nonHeaderOptions.value.findIndex(
      (opt) => opt.account?.id === selected.value
    );
    if (currentSelectionIndex !== -1) {
      highlightedIndex.value = currentSelectionIndex;
    }
    nextTick(() => {
      // Fokus wird bereits durch onFocus gesetzt, wenn darüber geöffnet wird.
      // Hier ggf. nur noch scrollen.
      // inputRef.value?.focus();
      // inputRef.value?.select();
      scrollToHighlighted();
    });
  }
}

/**
 * Schließt das Dropdown-Menü.
 */
function closeDropdown() {
  dropdownOpen.value = false;
  const currentAcc = accountStore.accounts.find((a) => a.id === selected.value);
  if (currentAcc && searchTerm.value !== currentAcc.name) {
    searchTerm.value = currentAcc.name;
  } else if (!selected.value) {
    // searchTerm.value = ""; // Behalte Text bei
  }
}

/**
 * Schließt das Dropdown verzögert, wenn der Fokus das Element verlässt.
 */
function onBlur(event: FocusEvent) {
  setTimeout(() => {
    const relatedTarget = event.relatedTarget as HTMLElement | null;
    if (!relatedTarget || !relatedTarget.closest(".dropdown-container")) {
      closeDropdown();
    }
  }, 200);
}

/**
 * Markiert den gesamten Text im Inputfeld, wenn es den Fokus erhält und öffnet ggf. das Dropdown.
 */
function onFocus(event: FocusEvent) {
  const target = event.target as HTMLInputElement;
  setTimeout(() => target.select(), 0);
  // Nur öffnen, wenn noch nicht offen, um Flackern zu vermeiden
  if (!dropdownOpen.value) {
    toggleDropdown();
  }
}

/**
 * Wählt ein Konto aus, aktualisiert den Zustand und schließt das Dropdown.
 */
function selectAccount(acc: (typeof accountStore.accounts)[0]) {
  debugLog("[SelectAccount] selectAccount", { id: acc.id, name: acc.name });
  selected.value = acc.id;
  searchTerm.value = acc.name;
  closeDropdown();
  debugLog("[SelectAccount] after selection", { selected: selected.value });
}

/**
 * Löscht den Suchbegriff und setzt den Fokus zurück auf das Inputfeld.
 */
function clearSearch() {
  searchTerm.value = "";
  selected.value = ""; // Auswahl aufheben
  emit("update:modelValue", undefined);
  emit("select", undefined);
  inputRef.value?.focus(); // Fokus zurückgeben
  if (!dropdownOpen.value) {
    toggleDropdown(); // Dropdown öffnen nach dem Löschen
  } else {
    highlightedIndex.value = 0; // Highlight zurücksetzen
  }
}

// Exponiert die focusInput Methode nach außen
defineExpose({ focusInput: () => inputRef.value?.focus() });
</script>

<template>
  <div class="relative dropdown-container">
    <!-- Input Feld mit Suchfunktion -->
    <div class="relative">
      <input
        ref="inputRef"
        type="text"
        class="input input-bordered w-full pr-8"
        v-model="searchTerm"
        @input="
          dropdownOpen = true;
          highlightedIndex = 0;
        "
        @keydown="onKeyDown"
        @focus="onFocus"
        @blur="onBlur"
        placeholder="Konto suchen..."
        autocomplete="off"
      />
      <!-- Button zum Löschen des Suchbegriffs -->
      <button
        type="button"
        v-if="searchTerm"
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
      v-if="dropdownOpen"
      class="absolute z-40 w-full bg-base-100 border border-base-300 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-lg dropdown-container"
      role="listbox"
    >
      <!-- Optionen oder "Keine Ergebnisse"-Meldung -->
      <template v-if="visibleOptions.length > 0">
        <template
          v-for="(option, idx) in visibleOptions"
          :key="option.isHeader ? 'header-' + idx : option.account?.id"
        >
          <!-- Header für Kontogruppen -->
          <div
            v-if="option.isHeader"
            class="px-3 py-1.5 font-semibold text-sm text-primary select-none sticky top-0 bg-base-200 z-10"
            role="separator"
          >
            {{ option.headerText }}
          </div>
          <!-- Konto-Option -->
          <div
            v-else
            :id="'select-account-option-' + option.account!.id"
            class="px-3 py-1.5 text-sm cursor-pointer hover:bg-base-200 flex justify-between items-center"
            :class="{
              'bg-base-300':
                nonHeaderOptions.findIndex(
                  (o) => o.account?.id === option.account?.id
                ) === highlightedIndex, // Hervorhebung für Tastatur
              'font-medium': option.account?.id === selected, // Hervorhebung für Auswahl
            }"
            @mousedown.prevent="selectAccount(option.account!)"
            role="option"
            :aria-selected="option.account?.id === selected"
          >
            <span>{{ option.account!.name }}</span>
            <CurrencyDisplay
              class="text-xs opacity-80"
              v-if="option.account"
              :amount="AccountService.getCurrentBalance(option.account.id)"
              :as-integer="true"
            />
          </div>
        </template>
      </template>
      <!-- Meldung bei keinen Ergebnissen -->
      <div v-else class="px-3 py-1.5 text-sm text-base-content/60 italic">
        Keine Konten gefunden.
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Verhindert, dass der Browser Autocomplete-Vorschläge über das Dropdown legt */
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
