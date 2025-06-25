<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { Account } from "../../types";
import { useAccountStore } from "../../stores/accountStore";
import CurrencyInput from "../ui/CurrencyInput.vue";
import { ImageService } from "../../services/ImageService"; // Import ImageService

const props = defineProps<{ account?: Account; isEdit?: boolean }>();
const emit = defineEmits(["save", "cancel"]);
const accountStore = useAccountStore();

const name = ref("");
const description = ref("");
const note = ref("");
const accountGroupId = ref("");
const iban = ref("");
const offset = ref(0);
const creditLimit = ref(0);
const image = ref<string | null>(null);
const originalImage = ref<string | null>(null);
const isUploadingLogo = ref(false);
const uploadMessage = ref<{ type: "success" | "error"; text: string } | null>(
  null
);
// Die onMounted-Logik wird hierhin verschoben und angepasst, um logoUrl zu verwenden
onMounted(() => {
  if (props.account) {
    name.value = props.account.name;
    description.value = props.account.description || "";
    note.value = props.account.note || "";
    accountGroupId.value = props.account.accountGroupId;
    iban.value = props.account.iban || "";
    offset.value = props.account.offset || 0;
    creditLimit.value = props.account.creditLimit || 0;
    image.value = props.account.imageUrl || null; // Verwende imageUrl
    originalImage.value = props.account.imageUrl || null; // Verwende imageUrl
  } else {
    accountGroupId.value = accountStore.accountGroups[0]?.id || "";
    offset.value = 0;
    creditLimit.value = 0;
  }
  nextTick(() => document.getElementById("account-name")?.focus());
});

// Die handleImageUpload-Logik wird hierhin verschoben und angepasst
const handleImageUpload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    // Temporäre URL für die Vorschau erstellen
    const tempImageUrl = URL.createObjectURL(file);
    image.value = tempImageUrl; // Setze das Bild sofort für die Vorschau

    isUploadingLogo.value = true;
    uploadMessage.value = null;
    try {
      const accountId = props.account?.id;
      if (!accountId && props.isEdit) {
        uploadMessage.value = {
          type: "error",
          text: "Konto-ID nicht gefunden. Upload nicht möglich.",
        };
        isUploadingLogo.value = false;
        return;
      }
      if (!accountId) {
        uploadMessage.value = {
          type: "error",
          text: "Bitte speichern Sie das Konto zuerst, um ein Logo hochzuladen.",
        };
        isUploadingLogo.value = false;
        return;
      }

      const response = await ImageService.uploadImage(file);

      if (response && response.image_url) {
        image.value = response.image_url; // Speichere den relativen Pfad vom Server
        uploadMessage.value = {
          type: "success",
          text: "Bild erfolgreich hochgeladen.",
        };
        // Direkter Aufruf von updateAccount mit dem neuen imageUrl
        await accountStore.updateAccount({
          id: accountId,
          imageUrl: response.image_url,
          updated_at: new Date().toISOString(),
        } as Account);
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
      // Wenn eine temporäre URL erstellt wurde, muss sie freigegeben werden,
      // sobald sie nicht mehr benötigt wird (z.B. nach dem Upload oder bei Fehler).
      // Hier ist es wichtig, dass die URL nur freigegeben wird, wenn sie nicht mehr im Gebrauch ist.
      // Da image.value auf den Server-Pfad gesetzt wird, ist die temporäre URL nicht mehr aktiv.
      if (tempImageUrl && image.value !== tempImageUrl) {
        URL.revokeObjectURL(tempImageUrl);
      }
    }
  }
};

// Die removeImage-Logik wird hierhin verschoben und angepasst
const removeImage = async () => {
  const logoPathToDelete = image.value; // Dies sollte der relative Pfad sein
  image.value = null;
  uploadMessage.value = null;

  if (props.account?.id) {
    if (logoPathToDelete) {
      try {
        await ImageService.deleteImage(logoPathToDelete);
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
        // Das Bild könnte lokal wiederhergestellt werden, wenn das serverseitige Löschen fehlschlägt,
        // aber für diesen Task belassen wir es bei der Fehlermeldung.
        // image.value = logoPathToDelete; // Optional: Lokales Bild wiederherstellen
        // return; // Breche ab, um Store nicht zu aktualisieren, wenn Server-Löschen fehlschlägt
      }
    }
    // Unabhängig vom Server-Lösch-Erfolg (oder wenn kein logoPathToDelete vorhanden war),
    // das Logo im Store auf null setzen.
    // Direkter Aufruf von updateAccount, um imageUrl auf null zu setzen
    await accountStore.updateAccount({
      id: props.account.id,
      imageUrl: null,
      updated_at: new Date().toISOString(),
    } as Account);
    if (!uploadMessage.value || uploadMessage.value.type === "success") {
      uploadMessage.value = {
        type: "success",
        text: "Logo im Formular und Store entfernt.",
      };
    }
  }
};

// Die saveAccount-Logik wird hierhin verschoben und angepasst
const saveAccount = () => {
  const accountData = {
    name: name.value,
    description: description.value,
    note: note.value,
    accountGroupId: accountGroupId.value,
    iban: iban.value,
    offset: offset.value,
    creditLimit: creditLimit.value,
    imageUrl: image.value || null, // image.value sollte den relativen Pfad enthalten
    isActive: props.account?.isActive ?? true,
    isOfflineBudget: props.account?.isOfflineBudget ?? false,
  };
  emit("save", accountData);
};

const accountGroups = computed(() => accountStore.accountGroups);

// Computed Property für die Anzeige des Logos
const displayLogoUrl = computed(() => {
  if (image.value) {
    // Wenn image.value eine volle URL ist (z.B. von externen Quellen oder temporäre Blob-URL), gib sie direkt zurück.
    if (
      image.value.startsWith("http://") ||
      image.value.startsWith("https://") ||
      image.value.startsWith("blob:")
    ) {
      return image.value;
    }
    // Wenn es ein relativer Pfad ist, konstruiere die URL über ImageService
    return ImageService.getImageUrl(image.value);
  }
  return null;
});
</script>

<template>
  <form
    @submit.prevent="saveAccount"
    class="space-y-4"
  >
    <div class="form-control">
      <label class="label"
        ><span class="label-text">Name</span
        ><span class="text-error">*</span></label
      >
      <input
        id="account-name"
        type="text"
        v-model="name"
        class="input input-bordered"
        required
        placeholder="Kontoname"
        autofocus
      />
    </div>

    <div class="form-control">
      <label class="label"><span class="label-text">Beschreibung</span></label>
      <input
        type="text"
        v-model="description"
        class="input input-bordered"
        placeholder="Kurze Beschreibung"
      />
    </div>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Kontogruppe</legend>
      <select
        v-model="accountGroupId"
        class="select select-bordered w-full"
        required
      >
        <option
          v-for="g in accountGroups"
          :key="g.id"
          :value="g.id"
        >
          {{ g.name }}
        </option>
      </select>
    </fieldset>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="form-control">
        <label class="label"><span class="label-text">IBAN</span></label>
        <input
          type="text"
          v-model="iban"
          class="input input-bordered"
          placeholder="DE12 3456 7890 1234 5678 90"
        />
      </div>
      <div class="form-control">
        <label class="label"
          ><span class="label-text"
            >Offset (Nulllinie für Statistiken)</span
          ></label
        >
        <CurrencyInput
          v-model="offset"
          placeholder="0,00"
        />
      </div>
    </div>

    <div class="form-control">
      <label class="label"><span class="label-text">Kreditlimit</span></label>
      <CurrencyInput
        v-model="creditLimit"
        placeholder="0,00"
      />
    </div>

    <div class="form-control">
      <label class="label"><span class="label-text">Notizen</span></label>
      <textarea
        v-model="note"
        class="textarea textarea-bordered h-24"
        placeholder="Zusätzliche Informationen"
      ></textarea>
    </div>

    <div class="form-control">
      <label class="label"
        ><span class="label-text">Konto Logo (JPG/PNG)</span></label
      >
      <input
        type="file"
        accept="image/jpeg,image/png"
        class="file-input file-input-bordered w-full"
        @change="handleImageUpload"
        :disabled="isUploadingLogo"
      />
      <div
        v-if="isUploadingLogo"
        class="mt-2 flex items-center"
      >
        <span class="loading loading-spinner loading-sm mr-2"></span>
        <span>Wird hochgeladen...</span>
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
      <div
        v-if="displayLogoUrl && !isUploadingLogo"
        class="mt-2"
      >
        <img
          :src="displayLogoUrl"
          alt="Vorschau"
          class="rounded-md max-h-32"
        />
        <button
          class="btn btn-error btn-sm mt-2"
          type="button"
          @click="removeImage"
          :disabled="isUploadingLogo"
        >
          Bild entfernen
        </button>
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
