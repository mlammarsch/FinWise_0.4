<!-- src/views/auth/LoginView.vue -->
<script setup lang="ts">
/**
 * Pfad zur Datei: src/views/auth/LoginView.vue
 * Einfache Login-Maske für lokale User-Accounts.
 */

import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { UserService } from "@/services/UserService";
import { errorLog } from "@/utils/logger";

const router = useRouter();

const username = ref("");
const password = ref("");
const errorMsg = ref("");

const usernameField = ref<HTMLInputElement | null>(null);
const passwordField = ref<HTMLInputElement | null>(null);
const loginButton = ref<HTMLButtonElement | null>(null);

onMounted(() => {
  if (usernameField.value) {
    usernameField.value.focus();
  }
});

async function onSubmit() {
  if (!username.value.trim() || !password.value.trim()) {
    errorMsg.value = "Benutzername und Passwort dürfen nicht leer sein.";
    return;
  }
  errorMsg.value = ""; // Fehler zurücksetzen bei erfolgreicher Validierung

  const ok = await UserService.login(username.value, password.value);
  if (ok) {
    router.push("/");
  } else {
    errorMsg.value =
      "Login fehlgeschlagen. Bitte überprüfen Sie Ihre Eingaben.";
    errorLog("[LoginView] login failed", { user: username.value });
  }
}

function focusPassword() {
  if (passwordField.value) {
    passwordField.value.focus();
  }
}

function focusLoginButton() {
  if (loginButton.value) {
    loginButton.value.focus();
  }
}
</script>

<template>
  <div class="flex items-center justify-center min-h-screen">
    <div class="card w-full max-w-md bg-base-100 border border-base-300 shadow">
      <div class="card-body space-y-4">
        <h2 class="text-xl font-bold text-center">Anmelden</h2>

        <div
          v-if="errorMsg"
          role="alert"
          class="alert alert-error alert-soft"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{{ errorMsg }}</span>
        </div>

        <input
          ref="usernameField"
          id="username"
          v-model.trim="username"
          type="text"
          placeholder="Benutzername"
          class="input input-bordered w-full"
          autocomplete="username"
          @keydown.enter.prevent="focusPassword"
          @keydown.tab.prevent="focusPassword"
        />
        <input
          ref="passwordField"
          id="password"
          v-model.trim="password"
          type="password"
          placeholder="Passwort"
          class="input input-bordered w-full"
          autocomplete="current-password"
          @keydown.enter.prevent="onSubmit"
          @keydown.tab.prevent="focusLoginButton"
        />

        <button
          ref="loginButton"
          class="btn btn-primary w-full"
          @click="onSubmit"
        >
          Einloggen
        </button>

        <div class="text-center text-sm opacity-70">
          Noch kein Account?
          <router-link
            to="/register"
            class="link link-primary"
            >Registrieren</router-link
          >
        </div>
      </div>
    </div>
  </div>
</template>
