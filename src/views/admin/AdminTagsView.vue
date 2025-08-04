it
<script setup lang="ts">
import { ref, computed } from "vue";
import { useTagStore } from "../../stores/tagStore";
import { useTransactionStore } from "../../stores/transactionStore";
import type { Tag } from "../../types";
import SearchGroup from "../../components/ui/SearchGroup.vue";
import PagingComponent from "../../components/ui/PagingComponent.vue";
import SearchableSelect from "../../components/ui/SearchableSelect.vue";
import BadgeSoft from "../../components/ui/BadgeSoft.vue";
import ColorPicker from "../../components/ui/ColorPicker.vue";
import TextInput from "../../components/ui/TextInput.vue";
import { getRandomTagColor } from "../../utils/tagColorUtils";

const tagStore = useTagStore();
const transactionStore = useTransactionStore();

const showTagModal = ref(false);
const isEditMode = ref(false);
const selectedTag = ref<Tag | null>(null);
const showColorPicker = ref(false);
const tagBeingEditedForColor = ref<Tag | null>(null); // für Liste
const editingTagId = ref<string | null>(null); // für Inline-Bearbeitung
const clickTimeout = ref<NodeJS.Timeout | null>(null); // für Click/Doppelclick-Unterscheidung

const searchQuery = ref("");
const currentPage = ref(1);
const itemsPerPage = ref<number | string>(25);

// Sortierungsstate
const sortField = ref<"name" | "usage">("name");
const sortDirection = ref<"asc" | "desc">("asc");

const filteredTags = computed(() => {
  let filtered = tagStore.tags;

  // Filtern nach Suchbegriff
  if (searchQuery.value.trim() !== "") {
    filtered = filtered.filter((tag) =>
      tag.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    );
  }

  // Sortieren
  return [...filtered].sort((a, b) => {
    let aValue: string | number;
    let bValue: string | number;

    if (sortField.value === "name") {
      aValue = a.name.toLowerCase();
      bValue = b.name.toLowerCase();
    } else {
      // usage
      aValue = tagUsage.value(a.id);
      bValue = tagUsage.value(b.id);
    }

    let comparison = 0;
    if (aValue < bValue) {
      comparison = -1;
    } else if (aValue > bValue) {
      comparison = 1;
    }

    return sortDirection.value === "asc" ? comparison : -comparison;
  });
});

const totalPages = computed(() => {
  if (itemsPerPage.value === "all") return 1;
  return Math.ceil(filteredTags.value.length / Number(itemsPerPage.value));
});

const paginatedTags = computed(() => {
  if (itemsPerPage.value === "all") return filteredTags.value;
  const start = (currentPage.value - 1) * Number(itemsPerPage.value);
  const end = start + Number(itemsPerPage.value);
  return filteredTags.value.slice(start, end);
});

const tagUsage = computed(() => {
  return (tagId: string) =>
    transactionStore.transactions.filter((tx) => tx.tagIds.includes(tagId))
      .length;
});

const getParentTagName = (parentId: string | null | undefined): string => {
  if (!parentId) return "-";
  const parent = tagStore.tags.find((t) => t.id === parentId);
  return parent ? parent.name : "Unbekannt";
};

const createTag = () => {
  selectedTag.value = {
    id: "", // Leere ID - wird vom TagStore erkannt und durch UUID ersetzt
    name: "",
    parentTagId: null,
    color: getRandomTagColor(),
  };
  isEditMode.value = false;
  showTagModal.value = true;
};

const editTag = (tag: Tag) => {
  selectedTag.value = { ...tag };
  isEditMode.value = true;
  showTagModal.value = true;
};

const saveTag = () => {
  if (!selectedTag.value) return;
  if (isEditMode.value) {
    tagStore.updateTag(selectedTag.value);
  } else {
    tagStore.addTag({ ...selectedTag.value });
  }
  showTagModal.value = false;
};

const closeModal = () => {
  showTagModal.value = false;
};

const showReplaceTagModal = ref(false);
const selectedTagToDelete = ref<Tag | null>(null);
const replacementTagId = ref<string>("");

const replacementOptions = computed(() => {
  const options = tagStore.tags
    .filter(
      (tag) =>
        selectedTagToDelete.value && tag.id !== selectedTagToDelete.value.id
    )
    .map((tag) => ({ id: tag.id, name: tag.name }));
  return [{ id: "", name: "Kein Tag" }, ...options];
});

const replaceTagInTransactions = (oldTag: Tag, newTagId: string | "") => {
  transactionStore.transactions.forEach((tx) => {
    if (tx.tagIds.includes(oldTag.id)) {
      const newTags = tx.tagIds.filter((id) => id !== oldTag.id);
      if (newTagId && !newTags.includes(newTagId)) newTags.push(newTagId);
      transactionStore.updateTransaction(tx.id, { tagIds: newTags });
    }
  });
};

const deleteTag = (tag: Tag) => {
  if (tagUsage.value(tag.id) > 0) {
    selectedTagToDelete.value = tag;
    replacementTagId.value = "";
    showReplaceTagModal.value = true;
  } else {
    if (confirm(`Möchten Sie das Tag "${tag.name}" wirklich löschen?`)) {
      tagStore.deleteTag(tag.id);
    }
  }
};

const openColorPicker = (tag: Tag | null) => {
  tagBeingEditedForColor.value = tag;
  showColorPicker.value = true;
};

const onColorSelected = (farbe: string) => {
  if (tagBeingEditedForColor.value) {
    const tag = tagBeingEditedForColor.value;
    tagStore.updateTag({ ...tag, color: farbe });
  } else if (selectedTag.value) {
    selectedTag.value.color = farbe;
  }
  showColorPicker.value = false;
  tagBeingEditedForColor.value = null;
};

const cancelColorPicker = () => {
  showColorPicker.value = false;
  tagBeingEditedForColor.value = null;
};

// Sortierungsfunktionen
const toggleSort = (field: "name" | "usage") => {
  if (sortField.value === field) {
    // Gleiche Spalte: Richtung umkehren
    sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
  } else {
    // Neue Spalte: auf aufsteigend setzen
    sortField.value = field;
    sortDirection.value = "asc";
  }
};

const getSortIcon = (field: "name" | "usage") => {
  if (sortField.value !== field) {
    return "mdi:sort";
  }
  return sortDirection.value === "asc"
    ? "mdi:sort-ascending"
    : "mdi:sort-descending";
};

// Inline-Bearbeitung
const startInlineEdit = (tagId: string) => {
  editingTagId.value = tagId;
};

const finishInlineEdit = () => {
  editingTagId.value = null;
};

const saveInlineEdit = (tagId: string, newName: string) => {
  if (newName.trim() === '') {
    finishInlineEdit();
    return;
  }

  const tag = tagStore.tags.find(t => t.id === tagId);
  if (tag && tag.name !== newName.trim()) {
    tagStore.updateTag({ ...tag, name: newName.trim() });
  }
  finishInlineEdit();
};

// Click/Doppelclick-Behandlung
const handleTagClick = (tag: Tag) => {
  // Einzelklick: Verzögerung für Farbwahl
  clickTimeout.value = setTimeout(() => {
    if (clickTimeout.value) {
      openColorPicker(tag);
      clickTimeout.value = null;
    }
  }, 250); // 250ms Verzögerung
};

const handleTagDoubleClick = (tag: Tag) => {
  // Doppelklick: Timeout abbrechen und Namensbearbeitung starten
  if (clickTimeout.value) {
    clearTimeout(clickTimeout.value);
    clickTimeout.value = null;
  }
  startInlineEdit(tag.id);
};
</script>

<template>
  <div class="max-w-4xl mx-auto flex flex-col min-h-screen py-8">


    <div
      class="flex w-full justify-between items-center mb-6 flex-wrap md:flex-nowrap"
    >
      <h2 class="text-xl font-bold flex-shrink-0">Tags verwalten</h2>
      <SearchGroup
        btnRight="Neu"
        btnRightIcon="mdi:plus"
        @search="(query: string) => (searchQuery = query)"
        @btn-right-click="createTag"
      />
    </div>

    <!-- Legende -->
    <div class="text-xs text-base-content/60 mb-2 flex items-center space-x-4">
      <span>💡 Einzelklick: Farbänderung | Doppelklick: Namensänderung</span>
    </div>

    <div class="card bg-base-100 shadow-md border border-base-300 w-full mt-6">
      <div class="card-body">
        <div class="overflow-x-auto">
          <table class="table table-zebra w-full max-w-full">
            <thead>
              <tr>
                <th
                  class="cursor-pointer hover:bg-base-200 select-none"
                  @click="toggleSort('name')"
                >
                  <div class="flex items-center justify-between">
                    <span>Name</span>
                    <Icon
                      :icon="getSortIcon('name')"
                      class="w-4 h-4 ml-1"
                      :class="{ 'text-primary': sortField === 'name' }"
                    />
                  </div>
                </th>
                <th class="text-center hidden md:table-cell">
                  Übergeordnetes Tag
                </th>
                <th
                  class="text-center hidden md:table-cell break-words whitespace-normal"
                >
                  Anzahl Unter-Tags
                </th>
                <th
                  class="text-center hidden md:table-cell break-words whitespace-normal cursor-pointer hover:bg-base-200 select-none"
                  @click="toggleSort('usage')"
                >
                  <div class="flex items-center justify-center">
                    <span>Verwendet in Buchungen</span>
                    <Icon
                      :icon="getSortIcon('usage')"
                      class="w-4 h-4 ml-1"
                      :class="{ 'text-primary': sortField === 'usage' }"
                    />
                  </div>
                </th>
                <th class="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="tag in paginatedTags"
                :key="tag.id"
              >
                <td>
                  <div v-if="editingTagId === tag.id" class="w-full">
                    <TextInput
                      :modelValue="tag.name"
                      :isActive="true"
                      :placeholder="tag.name"
                      @update:modelValue="(newName: string) => saveInlineEdit(tag.id, newName)"
                      @finish="finishInlineEdit"
                    />
                  </div>
                  <div v-else class="flex items-center space-x-2">
                    <BadgeSoft
                      :label="tag.name"
                      :colorIntensity="tag.color"
                      class="cursor-pointer select-none"
                      @click="handleTagClick(tag)"
                      @dblclick="handleTagDoubleClick(tag)"
                    />
                  </div>
                </td>
                <td class="text-center hidden md:table-cell">
                  {{ getParentTagName(tag.parentTagId) }}
                </td>
                <td
                  class="text-center hidden md:table-cell break-words whitespace-normal"
                >
                  {{ tagStore.getChildTags(tag.id).length }}
                </td>
                <td
                  class="text-center hidden md:table-cell break-words whitespace-normal"
                >
                  {{ tagUsage(tag.id) }}
                </td>
                <td class="text-right">
                  <div class="flex justify-end space-x-1">
                    <button
                      class="btn btn-ghost btn-sm text-secondary"
                      @click="editTag(tag)"
                    >
                      <Icon
                        icon="mdi:pencil"
                        class="text-base"
                      />
                    </button>
                    <button
                      class="btn btn-ghost btn-sm text-error"
                      @click="deleteTag(tag)"
                    >
                      <Icon
                        icon="mdi:trash-can"
                        class="text-base"
                      />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <PagingComponent
          :currentPage="currentPage"
          :totalPages="totalPages"
          :itemsPerPage="itemsPerPage"
          @update:currentPage="(val: number) => (currentPage = val)"
          @update:itemsPerPage="(val: number | string) => (itemsPerPage = val)"
        />
      </div>
    </div>
  </div>

  <!-- Modal für Tag bearbeiten/erstellen -->
  <div
    v-if="showTagModal"
    class="fixed modal modal-open flex items-center justify-center z-50"
  >
    <div
      class="bg-base-100 p-6 rounded-md w-full max-w-md shadow-lg border border-base-300"
    >
      <h3 class="text-lg font-bold mb-4">
        {{ isEditMode ? "Tag bearbeiten" : "Neues Tag erstellen" }}
      </h3>
      <div class="form-control mb-4">
        <label class="label"><span class="label-text">Name</span></label>
        <input
          v-model="selectedTag!.name"
          type="text"
          class="input input-bordered w-full"
        />
      </div>

      <div class="flex flex-col form-control mb-4">
        <label class="label"><span class="label-text">Farbe</span></label>
        <BadgeSoft
          label="Farbe wählen"
          :colorIntensity="selectedTag?.color || 'primary'"
          class="mb-2 cursor-pointer"
          @click="openColorPicker(null)"
        />
      </div>

      <div class="form-control mb-4">
        <label class="label"
          ><span class="label-text">Übergeordnetes Tag</span></label
        >
        <select
          v-model="selectedTag!.parentTagId"
          class="select select-bordered"
        >
          <option :value="null">Keines</option>
          <option
            v-for="tag in tagStore.tags"
            :key="tag.id"
            :value="tag.id"
          >
            {{ tag.name }}
          </option>
        </select>
      </div>

      <div class="flex justify-end space-x-2">
        <button
          class="btn btn-outline"
          @click="closeModal"
        >
          Abbrechen
        </button>
        <button
          class="btn btn-primary"
          @click="saveTag"
        >
          {{ isEditMode ? "Speichern" : "Erstellen" }}
        </button>
      </div>
    </div>
  </div>

  <!-- Farbwahl -->
  <div
    v-if="showColorPicker"
    class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
  >
    <ColorPicker
      @cancel="cancelColorPicker"
      @farbe-intensity="onColorSelected"
    />
  </div>

  <!-- Modal für Ersatz-Tag -->
  <div
    v-if="showReplaceTagModal"
    class="fixed modal modal-open flex items-center justify-center z-50"
  >
    <div
      class="bg-base-100 p-6 rounded-md w-full max-w-md shadow-lg border border-base-300"
    >
      <h3 class="text-lg font-bold mb-4">
        Tag ersetzen – Buchungen übertragen
      </h3>
      <p class="mb-4">
        Das Tag "{{ selectedTagToDelete?.name }}" wird in
        {{ tagUsage(selectedTagToDelete?.id || "") }} Buchungen verwendet. Bitte
        wählen Sie einen Ersatz-Tag oder „Kein Tag“.
      </p>
      <SearchableSelect
        v-model="replacementTagId"
        :options="replacementOptions"
        label="Ersatz-Tag"
        placeholder="Ersatz auswählen..."
      />
      <div class="flex justify-end space-x-2 mt-4">
        <button
          class="btn btn-outline"
          @click="showReplaceTagModal = false"
        >
          Abbrechen
        </button>
        <button
          class="btn btn-primary"
          @click="
            () => {
              if (selectedTagToDelete) {
                replaceTagInTransactions(selectedTagToDelete, replacementTagId);
                tagStore.deleteTag(selectedTagToDelete.id);
              }
              showReplaceTagModal = false;
            }
          "
        >
          Übernehmen
        </button>
      </div>
    </div>
  </div>
</template>
