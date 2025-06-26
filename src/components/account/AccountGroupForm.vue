<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { AccountGroup } from "../../types";
import { useAccountStore } from "../../stores/accountStore";
import { ImageService } from "../../services/ImageService"; // Import ImageService
import { useTenantStore } from "../../stores/tenantStore";

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
    image.value = props.group.logoPath || null;
    originalImage.value = props.group.logoPath || null;
  }
});

// Upload-Logik gemäß Task 3.2: POST /api/v1/logos/upload verwenden
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
      if (!accountGroupId) {
        uploadMessage.value = {
          type: "error",
          text: "Bitte speichern Sie die Kontogruppe zuerst, um ein Logo hochzuladen.",
        };
        isUploadingLogo.value = false;
        return;
      }

      const tenantStore = useTenantStore();
      const tenantId = tenantStore.activeTenantId;
      if (!tenantId) {
        uploadMessage.value = {
          type: "error",
          text: "Aktive Mandanten-ID nicht gefunden. Upload nicht möglich.",
        };
        isUploadingLogo.value = false;
        return;
      }
      // Verwende den neuen POST /api/v1/logos/upload Endpunkt
      const response = await ImageService.uploadLogo(
        accountGroupId,
        "account_group",
        file,
        tenantId
      );

      if (response && response.logo_path) {
        image.value = response.logo_path;
        uploadMessage.value = {
          type: "success",
          text: "Logo erfolgreich hochgeladen.",
        };
        // Nach erfolgreichem Upload: logoPath im Store aktualisieren für Synchronisation
        await accountStore.updateAccountGroupLogo(
          accountGroupId,
          response.logo_path
        );
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
      // Temporäre URL freigeben
      if (tempImageUrl && image.value !== tempImageUrl) {
        URL.revokeObjectURL(tempImageUrl);
      }
    }
  }
};

// Löschungs-Logik gemäß Task 3.2: Erst Store aktualisieren, dann DELETE-Endpunkt aufrufen
const removeImage = async () => {
  const logoPathToDelete = image.value; // Dies sollte der relative Pfad sein
  image.value = null;
  uploadMessage.value = null;

  if (props.group?.id) {
    try {
      // SCHRITT 1: Erst logoPath im Store auf null setzen und synchronisieren
      await accountStore.updateAccountGroupLogo(props.group.id, null);

      uploadMessage.value = {
        type: "success",
        text: "Logo-Referenz erfolgreich entfernt.",
      };

      // SCHRITT 2: Erst NACH erfolgreicher Store-Synchronisation die physische Datei löschen
      if (logoPathToDelete) {
        try {
          await ImageService.deleteLogo(logoPathToDelete);
          uploadMessage.value = {
            type: "success",
            text: "Logo erfolgreich entfernt.",
          };
        } catch (error) {
          console.error(
            "Fehler beim Löschen der physischen Datei vom Server:",
            error
          );
          // Physische Datei konnte nicht gelöscht werden, aber Store-Referenz ist bereits entfernt
          // Dies ist weniger kritisch, da die Referenz bereits entfernt wurde
          uploadMessage.value = {
            type: "success", // Immer noch Erfolg, da Store-Update erfolgreich war
            text: "Logo-Referenz entfernt. Physische Datei konnte nicht gelöscht werden.",
          };
        }
      }
    } catch (error) {
      console.error("Fehler beim Aktualisieren des Stores:", error);
      // Store-Update fehlgeschlagen - Bild wiederherstellen
      image.value = logoPathToDelete;
      uploadMessage.value = {
        type: "error",
        text: "Fehler beim Entfernen der Logo-Referenz. Vorgang abgebrochen.",
      };
    }
  }
};

const saveGroup = () => {
  const groupData: Omit<AccountGroup, "id" | "updated_at"> & {
    logoPath?: string | null;
  } = {
    name: name.value,
    sortOrder: sortOrder.value,
    logoPath: image.value || undefined,
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
    image.value = props.group.logoPath || null; // Korrigiert zu logoPath
    originalImage.value = props.group.logoPath || null; // Korrigiert zu logoPath
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
