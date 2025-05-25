<script setup>
import { ref, defineEmits, defineProps } from "vue";
import { Icon } from "@iconify/vue";

/**
 * Pfad zur Komponente: components/ui/SearchGroup.vue
 * Eine Suchleiste mit optionalen Buttons und Events.
 *
 * Komponenten-Props:
 * - btnLeft?: string - Label für den linken Button (optional)
 * - btnLeftIcon?: string - Icon für den linken Button (optional)
 * - btnMiddle?: string - Label für den mittleren Button (optional)
 * - btnMiddleIcon?: string - Icon für den mittleren Button (optional)
 * - btnRight?: string - Label für den rechten Button (optional)
 * - btnRightIcon?: string - Icon für den rechten Button (optional)
 *
 * Emits:
 * - search: Löst eine Suche aus (bei Eingabe und Klick auf Lupe)
 * - btn-left-click: Wird ausgelöst, wenn der linke Button geklickt wird
 * - btn-middle-click: Wird ausgelöst, wenn der mittlere Button geklickt wird
 * - btn-right-click: Wird ausgelöst, wenn der rechte Button geklickt wird
 */

const props = defineProps({
  btnLeft: String,
  btnLeftIcon: String,
  btnMiddle: String,
  btnMiddleIcon: String,
  btnRight: String,
  btnRightIcon: String,
});

const searchQuery = ref("");
const emit = defineEmits([
  "search",
  "btn-left-click",
  "btn-middle-click",
  "btn-right-click",
]);

const triggerSearch = () => {
  emit("search", searchQuery.value);
};

const clearSearch = () => {
  searchQuery.value = "";
  emit("search", "");
};

const selectAll = (e) => {
  const input = e.target;
  input.select();
};
</script>

<template>
  <div class="flex justify-end w-full md:w-auto mt-2 md:mt-0">
    <div class="join flex items-center relative">
      <!-- Wrapper um Input + Icon -->
      <div class="relative">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Suche..."
          class="input join-item rounded-l-full input-sm input-bordered border-1 border-base-300 text-center pr-8"
          @keyup="triggerSearch"
          @focus="selectAll"
        />
        <!-- X Icon im Feld -->
        <button
          v-if="searchQuery"
          @click="clearSearch"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-base text-neutral/60 hover:text-error/60"
        >
          <Icon icon="mdi:close-circle-outline" />
        </button>
      </div>

      <!-- Suchbutton -->
      <button
        class="btn join-item btn-sm btn-soft border border-base-300 flex items-center justify-center"
        @click="triggerSearch"
      >
        <Icon
          icon="mdi:magnify"
          class="text-lg"
        />
      </button>

      <!-- Linker Button (optional) -->
      <button
        v-if="btnLeft"
        class="btn join-item btn-sm btn-soft border border-base-300 flex items-center justify-center"
        @click="$emit('btn-left-click')"
      >
        <Icon
          v-if="btnLeftIcon"
          :icon="btnLeftIcon"
          class="mr-2"
        />
        {{ btnLeft }}
      </button>

      <!-- Mittlerer Button (optional) -->
      <button
        v-if="btnMiddle"
        class="btn join-item btn-sm btn-soft border border-base-300 flex items-center justify-center"
        @click="$emit('btn-middle-click')"
      >
        <Icon
          v-if="btnMiddleIcon"
          :icon="btnMiddleIcon"
          class="mr-2"
        />
        {{ btnMiddle }}
      </button>

      <!-- Rechter Button (optional) -->
      <button
        v-if="btnRight"
        class="btn join-item rounded-r-full btn-sm btn-soft border border-base-300 flex items-center justify-center pr-5"
        @click="$emit('btn-right-click')"
      >
        <Icon
          v-if="btnRightIcon"
          :icon="btnRightIcon"
          class=""
        />
        {{ btnRight }}
      </button>
    </div>
  </div>
</template>
