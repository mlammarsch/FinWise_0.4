<!-- src/views/auth/RegisterView.vue -->
<script setup lang="ts">
/**
 * Pfad zur Datei: src/views/auth/RegisterView.vue
 * Registriert ersten (oder weiteren) lokalen User.
 */

import { ref } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "@/stores/userStore";
import { debugLog, errorLog } from "@/utils/logger";

const router = useRouter();
const userStore = useUserStore();

const username = ref("");
const email = ref("");
const password = ref("");
const passwordRepeat = ref("");
const errorMsg = ref("");

async function onSubmit() {
  if (!username.value.trim() || !email.value.trim() || !password.value.trim()) {
    errorMsg.value = "Bitte alle Felder ausfüllen";
    return;
  }
  if (password.value !== passwordRepeat.value) {
    errorMsg.value = "Passwörter stimmen nicht überein";
    return;
  }
  const newUser = await userStore.registerUser(
    username.value,
    email.value,
    password.value
  );
  if (newUser) {
    debugLog("[RegisterView] user created", { id: newUser.id });
    router.push("/login");
  } else {
    errorMsg.value = "Benutzername bereits vergeben";
    errorLog("[RegisterView] registration failed", { user: username.value });
  }
}
</script>

<template>
  <div class="flex items-center justify-center min-h-screen">
    <div class="card w-full max-w-md bg-base-100 border border-base-300 shadow">
      <div class="card-body space-y-4">
        <h2 class="text-xl font-bold text-center">Registrieren</h2>

        <input
          v-model.trim="username"
          type="text"
          placeholder="Benutzername"
          class="input input-bordered w-full"
          autocomplete="username"
        />
        <input
          v-model.trim="email"
          type="email"
          placeholder="E-Mail"
          class="input input-bordered w-full"
          autocomplete="email"
        />
        <input
          v-model.trim="password"
          type="password"
          placeholder="Passwort"
          class="input input-bordered w-full"
          autocomplete="new-password"
        />
        <input
          v-model.trim="passwordRepeat"
          type="password"
          placeholder="Passwort wiederholen"
          class="input input-bordered w-full"
          autocomplete="new-password"
          @keyup.enter="onSubmit"
        />

        <p v-if="errorMsg" class="text-error text-sm">{{ errorMsg }}</p>

        <button class="btn btn-primary w-full" @click="onSubmit">
          Account anlegen
        </button>

        <div class="text-center text-sm opacity-70">
          Schon registriert?
          <router-link to="/login" class="link link-primary"
            >Zum Login</router-link
          >
        </div>
      </div>
    </div>
  </div>
</template>
