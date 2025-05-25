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

const tagStore = useTagStore();
const transactionStore = useTransactionStore();

const showTagModal = ref(false);
const isEditMode = ref(false);
const selectedTag = ref<Tag | null>(null);
const showColorPicker = ref(false);
const tagBeingEditedForColor = ref<Tag | null>(null); // für Liste

const searchQuery = ref("");
const currentPage = ref(1);
const itemsPerPage = ref<number | string>(25);

const filteredTags = computed(() => {
  if (searchQuery.value.trim() === "") return tagStore.tags;
  return tagStore.tags.filter((tag) =>
    tag.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  );
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

const getParentTagName = (parentId: string | null): string => {
  if (!parentId) return "-";
  const parent = tagStore.tags.find((t) => t.id === parentId);
  return parent ? parent.name : "Unbekannt";
};

const createTag = () => {
  selectedTag.value = {
    id: "",
    name: "",
    parentTagId: null,
    color: "primary",
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
        @search="(query) => (searchQuery.value = query)"
        @btn-right-click="createTag"
      />
    </div>

    <div class="card bg-base-100 shadow-md border border-base-300 w-full mt-6">
      <div class="card-body">
        <div class="overflow-x-auto">
          <table class="table table-zebra w-full max-w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th class="text-center hidden md:table-cell">Farbe</th>
                <th class="text-center hidden md:table-cell">
                  Übergeordnetes Tag
                </th>
                <th
                  class="text-center hidden md:table-cell break-words whitespace-normal"
                >
                  Anzahl Unter-Tags
                </th>
                <th
                  class="text-center hidden md:table-cell break-words whitespace-normal"
                >
                  Verwendet in Buchungen
                </th>
                <th class="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="tag in paginatedTags" :key="tag.id">
                <td>{{ tag.name }}</td>
                <td class="text-center hidden md:table-cell">
                  <BadgeSoft
                    :label="tag.color"
                    :colorIntensity="tag.color"
                    class="cursor-pointer"
                    @click="openColorPicker(tag)"
                  />
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
                      <Icon icon="mdi:pencil" class="text-base" />
                    </button>
                    <button
                      class="btn btn-ghost btn-sm text-error"
                      @click="deleteTag(tag)"
                    >
                      <Icon icon="mdi:trash-can" class="text-base" />
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
          @update:currentPage="(val) => (currentPage.value = val)"
          @update:itemsPerPage="(val) => (itemsPerPage.value = val)"
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
          v-model="selectedTag.name"
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
          v-model="selectedTag.parentTagId"
          class="select select-bordered"
        >
          <option :value="null">Keines</option>
          <option v-for="tag in tagStore.tags" :key="tag.id" :value="tag.id">
            {{ tag.name }}
          </option>
        </select>
      </div>

      <div class="flex justify-end space-x-2">
        <button class="btn btn-outline" @click="closeModal">Abbrechen</button>
        <button class="btn btn-primary" @click="saveTag">
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
        <button class="btn btn-outline" @click="showReplaceTagModal = false">
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
