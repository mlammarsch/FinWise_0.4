<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { Account } from "../../types";
import { useAccountStore } from "../../stores/accountStore";
import CurrencyInput from "../ui/CurrencyInput.vue";

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

onMounted(() => {
  if (props.account) {
    name.value = props.account.name;
    description.value = props.account.description || "";
    note.value = props.account.note || "";
    accountGroupId.value = props.account.accountGroupId;
    iban.value = props.account.iban || "";
    offset.value = props.account.offset || 0;
    creditLimit.value = props.account.creditLimit || 0;
    image.value = props.account.image || null;
    originalImage.value = props.account.image || null;
  } else {
    accountGroupId.value = accountStore.accountGroups[0]?.id || "";
    offset.value = 0;
    creditLimit.value = 0;
  }
  nextTick(() => document.getElementById("account-name")?.focus());
});

const handleImageUpload = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onloadend = () => (image.value = reader.result as string);
    reader.readAsDataURL(file);
  }
};

const removeImage = () => (image.value = null);

const saveAccount = () => {
  if (originalImage.value && originalImage.value !== image.value) {
    const stillUsed = accountStore.accounts.some(
      (a) => a.image === originalImage.value && a.id !== props.account?.id
    );
    // Keine Dateioperation nötig
  }
  const accountData: Omit<Account, "id"> = {
    name: name.value,
    description: description.value,
    note: note.value,
    accountGroupId: accountGroupId.value,
    iban: iban.value,
    offset: offset.value,
    creditLimit: creditLimit.value,
    image: image.value || undefined,
    isActive: props.account?.isActive ?? true,
    isOfflineBudget: props.account?.isOfflineBudget ?? false,
    balance: 0,
    sortOrder: props.account?.sortOrder ?? 0,
    accountType: undefined,
  };
  emit("save", accountData);
};

const accountGroups = computed(() => accountStore.accountGroups);
</script>

<template>
  <form @submit.prevent="saveAccount" class="space-y-4">
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
        <option v-for="g in accountGroups" :key="g.id" :value="g.id">
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
        <CurrencyInput v-model="offset" placeholder="0,00" />
      </div>
    </div>

    <div class="form-control">
      <label class="label"><span class="label-text">Kreditlimit</span></label>
      <CurrencyInput v-model="creditLimit" placeholder="0,00" />
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
        ><span class="label-text">Konto Bild (JPG/PNG)</span></label
      >
      <input
        type="file"
        accept="image/jpeg,image/png"
        class="file-input file-input-bordered w-full"
        @change="handleImageUpload"
      />
      <div v-if="image" class="mt-2">
        <img :src="image" alt="Vorschau" class="rounded-md max-h-32" />
        <button
          class="btn btn-error btn-sm mt-2"
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
