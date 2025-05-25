<script setup lang="ts">
import { ref, onMounted } from "vue";
import { AccountGroup } from "../../types";
import { useAccountStore } from "../../stores/accountStore";

const props = defineProps<{
  group?: AccountGroup;
  isEdit?: boolean;
}>();

const emit = defineEmits(["save", "cancel"]);

const accountStore = useAccountStore();

const name = ref("");
const sortOrder = ref(0);
const image = ref<string | null>(null);
const originalImage = ref<string | null>(null);

onMounted(() => {
  if (props.group) {
    name.value = props.group.name;
    sortOrder.value = props.group.sortOrder;
    image.value = props.group.image || null;
    originalImage.value = props.group.image || null;
  }
});

const handleImageUpload = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onloadend = () => {
      image.value = reader.result as string;
    };
    reader.readAsDataURL(file);
  }
};

const removeImage = () => {
  image.value = null;
};

const saveGroup = () => {
  if (originalImage.value && originalImage.value !== image.value) {
    const isStillUsed = accountStore.accountGroups.some(
      (g) => g.image === originalImage.value && g.id !== props.group?.id
    );
    if (!isStillUsed) {
      // Placeholder für späteren Löschmechanismus (Server/API)
    }
  }

  const groupData: Omit<AccountGroup, "id"> = {
    name: name.value,
    sortOrder: sortOrder.value,
    image: image.value || undefined,
  };
  emit("save", groupData);
};
</script>

<template>
  <form @submit.prevent="saveGroup" class="space-y-4">
    <div class="form-control">
      <label class="label">
        <span class="label-text">Name der Kontogruppe</span>
        <span class="text-error">*</span>
      </label>
      <input
        type="text"
        v-model="name"
        class="input input-bordered"
        required
        placeholder="Name der Gruppe"
      />
    </div>

    <div class="form-control">
      <label class="label">
        <span class="label-text">Sortierung</span>
      </label>
      <input
        type="number"
        v-model="sortOrder"
        class="input input-bordered"
        min="0"
      />
    </div>

    <div class="form-control">
      <label class="label">
        <span class="label-text">Gruppen Bild (JPG oder PNG)</span>
      </label>
      <input
        type="file"
        class="file-input file-input-bordered w-full"
        accept="image/jpeg, image/png"
        @change="handleImageUpload"
      />
      <div v-if="image" class="mt-2">
        <img
          :src="image"
          alt="Gruppen Bild Vorschau"
          class="rounded-md max-h-32"
        />
        <button
          class="btn btn-sm btn-error mt-2"
          type="button"
          @click="removeImage"
        >
          Bild entfernen
        </button>
      </div>
    </div>

    <div class="flex justify-end space-x-2 pt-4">
      <button type="button" class="btn" @click="emit('cancel')">
        Abbrechen
      </button>
      <button type="submit" class="btn btn-primary">Speichern</button>
    </div>
  </form>
</template>
