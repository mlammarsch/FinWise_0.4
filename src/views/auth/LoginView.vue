<!-- src/views/auth/LoginView.vue -->
<script setup lang="ts">
/**
 * Pfad zur Datei: src/views/auth/LoginView.vue
 * Einfache Login-Maske für lokale User-Accounts.
 */

import { ref } from "vue";
import { useRouter } from "vue-router";
import { UserService } from "@/services/UserService";
import { errorLog } from "@/utils/logger";

const router = useRouter();

const username = ref("");
const password = ref("");
const errorMsg = ref("");

async function onSubmit() {
  if (!username.value.trim() || !password.value.trim()) {
    errorMsg.value = "Bitte alle Felder ausfüllen";
    return;
  }

  const ok = await UserService.login(username.value, password.value);
  if (ok) {
    router.push("/");
  } else {
    errorMsg.value = "Login fehlgeschlagen";
    errorLog("[LoginView] login failed", { user: username.value });
  }
}
</script>

<template>
  <div class="flex items-center justify-center min-h-screen">
    <div class="card w-full max-w-md bg-base-100 border border-base-300 shadow">
      <div class="card-body space-y-4">
        <h2 class="text-xl font-bold text-center">Anmelden</h2>

        <input
          v-model.trim="username"
          type="text"
          placeholder="Benutzername"
          class="input input-bordered w-full"
          autocomplete="username"
        />
        <input
          v-model.trim="password"
          type="password"
          placeholder="Passwort"
          class="input input-bordered w-full"
          autocomplete="current-password"
          @keyup.enter="onSubmit"
        />

        <p v-if="errorMsg" class="text-error text-sm">{{ errorMsg }}</p>

        <button class="btn btn-primary w-full" @click="onSubmit">
          Einloggen
        </button>

        <div class="text-center text-sm opacity-70">
          Noch kein Account?
          <router-link to="/register" class="link link-primary"
            >Registrieren</router-link
          >
        </div>
      </div>
    </div>
  </div>
</template>
