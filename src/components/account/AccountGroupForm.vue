<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { AccountGroup } from "../../types";
import { useAccountStore } from "../../stores/accountStore";
import { ImageService } from "../../services/ImageService"; // Import ImageService

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
const isUploadingLogo = ref(false);
const uploadMessage = ref<{ type: "success" | "error"; text: string } | null>(
  null
);

onMounted(() => {
  if (props.group) {
    name.value = props.group.name;
    sortOrder.value = props.group.sortOrder;
    image.value = props.group.image || null;
    originalImage.value = props.group.image || null;
  }
});

const handleImageUpload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    const tempImageUrl = URL.createObjectURL(file);
    image.value = tempImageUrl;

    isUploadingLogo.value = true;
    uploadMessage.value = null;
    try {
      const accountGroupId = props.group?.id;
      if (!accountGroupId && props.isEdit) {
        uploadMessage.value = {
          type: "error",
          text: "Kontogruppen-ID nicht gefunden. Upload nicht möglich.",
        };
        isUploadingLogo.value = false;
        return;
      }
      const currentEntityId = accountGroupId || "temp-new-accountgroup-id";

      const response = await ImageService.uploadLogo(
        currentEntityId,
        "account_group",
        file
      );

      if (response && response.logo_path) {
        image.value = response.logo_path;
        uploadMessage.value = {
          type: "success",
          text: "Logo erfolgreich hochgeladen.",
        };
        if (props.group?.id) {
          accountStore.updateAccountGroupLogo(
            props.group.id,
            response.logo_path
          );
        }
      } else {
        uploadMessage.value = {
          type: "error",
          text: "Das Logo konnte nicht hochgeladen werden. Bitte versuchen Sie es später erneut.",
        };
        if (originalImage.value) image.value = originalImage.value;
        else image.value = null;
      }
    } catch (error: any) {
      console.error("Error uploading logo in component:", error);
      let specificMessage = "Fehler beim Hochladen des Logos.";
      if (error.status === 415) {
        specificMessage =
          "Ungültiges Dateiformat. Bitte JPG oder PNG verwenden.";
      } else if (error.status === 413) {
        specificMessage = "Die Datei ist zu groß.";
      } else if (error.message && error.message.includes("NetworkError")) {
        specificMessage =
          "Netzwerkfehler. Bitte überprüfen Sie Ihre Verbindung.";
      }
      uploadMessage.value = {
        type: "error",
        text: specificMessage,
      };
      if (originalImage.value) image.value = originalImage.value;
      else image.value = null;
    } finally {
      isUploadingLogo.value = false;
      if (tempImageUrl && image.value !== tempImageUrl) {
        URL.revokeObjectURL(tempImageUrl);
      }
    }
  }
};

const removeImage = async () => {
  const logoPathToDelete = image.value; // Dies sollte der relative Pfad sein
  image.value = null;
  uploadMessage.value = null;

  if (props.group?.id) {
    if (logoPathToDelete) {
      try {
        await ImageService.deleteLogo(logoPathToDelete);
        uploadMessage.value = {
          type: "success",
          text: "Logo erfolgreich vom Server entfernt.",
        };
      } catch (error) {
        console.error("Fehler beim Löschen des Logos vom Server:", error);
        uploadMessage.value = {
          type: "error",
          text: "Fehler beim Entfernen des Logos vom Server.",
        };
        // image.value = logoPathToDelete; // Optional: Lokales Bild wiederherstellen
        // return;
      }
    }
    accountStore.updateAccountGroupLogo(props.group.id, null);
    if (!uploadMessage.value || uploadMessage.value.type === "success") {
      uploadMessage.value = {
        type: "success",
        text: "Logo im Formular und Store entfernt.",
      };
    }
  }
};

const saveGroup = () => {
  const groupData: Omit<AccountGroup, "id" | "updated_at"> & {
    logo_path?: string | null;
  } = {
    name: name.value,
    sortOrder: sortOrder.value,
    logo_path: image.value || undefined, // image.value sollte den relativen Pfad enthalten
  };
  // Wenn props.group.id existiert, fügen wir es hinzu, damit updateAccountGroup es verwenden kann
  const saveData = props.group?.id
    ? { ...groupData, id: props.group.id }
    : groupData;
  emit("save", saveData);
};

// Computed Property für die Anzeige des Logos
const displayLogoUrl = computed(() => {
  if (image.value) {
    if (
      image.value.startsWith("http://") ||
      image.value.startsWith("https://") ||
      image.value.startsWith("blob:")
    ) {
      return image.value;
    }
    return ImageService.getLogoUrl(image.value);
  }
  return null;
});

// onMounted anpassen, um logoUrl zu verwenden
onMounted(() => {
  if (props.group) {
    name.value = props.group.name;
    sortOrder.value = props.group.sortOrder;
    image.value = props.group.logo_path || null; // Verwende logo_path
    originalImage.value = props.group.logo_path || null; // Verwende logo_path
  }
});
</script>

<template>
  <form
    @submit.prevent="saveGroup"
    class="space-y-4"
  >
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
        <span class="label-text">Logo (JPG oder PNG)</span>
      </label>
      <div class="flex items-center space-x-4">
        <div
          v-if="displayLogoUrl"
          class="avatar"
        >
          <div class="w-24 rounded">
            <img
              :src="displayLogoUrl"
              alt="Aktuelles Logo"
            />
          </div>
        </div>
        <div
          v-else
          class="avatar placeholder"
        >
          <div class="bg-neutral-focus text-neutral-content rounded w-24">
            <span>Kein Logo</span>
          </div>
        </div>

        <input
          type="file"
          accept="image/png, image/jpeg"
          class="hidden"
          ref="fileInput"
          @change="handleImageUpload"
        />

        <div class="flex flex-col space-y-2">
          <button
            type="button"
            class="btn btn-sm btn-outline"
            @click="($refs.fileInput as HTMLInputElement)?.click()"
            :disabled="isUploadingLogo"
          >
            <span
              v-if="isUploadingLogo"
              class="loading loading-spinner loading-xs mr-2"
            ></span>
            {{ displayLogoUrl ? "Logo ändern" : "Logo hochladen" }}
          </button>
          <button
            v-if="displayLogoUrl && !isUploadingLogo"
            type="button"
            class="btn btn-sm btn-error btn-outline"
            @click="removeImage"
            :disabled="isUploadingLogo"
          >
            Logo löschen
          </button>
        </div>
      </div>
      <div
        v-if="uploadMessage"
        :class="[
          'mt-2 p-2 rounded-md text-sm',
          uploadMessage.type === 'success'
            ? 'bg-success text-success-content'
            : 'bg-error text-error-content',
        ]"
      >
        {{ uploadMessage.text }}
      </div>
    </div>

    <div class="flex justify-end space-x-2 pt-4">
      <button
        type="button"
        class="btn"
        @click="emit('cancel')"
      >
        Abbrechen
      </button>
      <button
        type="submit"
        class="btn btn-primary"
      >
        Speichern
      </button>
    </div>
  </form>
</template>
