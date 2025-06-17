<!-- src/views/auth/RegisterView.vue -->
<script setup lang="ts">
/**
 * Pfad zur Datei: src/views/auth/RegisterView.vue
 * Registriert ersten (oder weiteren) lokalen User.
 */

import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "../../stores/userStore";
import { debugLog, errorLog } from "../../utils/logger";

const router = useRouter();
const userStore = useUserStore();

const username = ref("");
const email = ref("");
const password = ref("");
const passwordRepeat = ref("");
const errorMsg = ref("");
const successMsg = ref("");

const usernameField = ref<HTMLInputElement | null>(null);
const emailField = ref<HTMLInputElement | null>(null);
const passwordField = ref<HTMLInputElement | null>(null);
const passwordRepeatField = ref<HTMLInputElement | null>(null);
const registerButton = ref<HTMLButtonElement | null>(null);

onMounted(() => {
  usernameField.value?.focus();
});

async function onSubmit() {
  errorMsg.value = "";
  successMsg.value = "";

  if (
    !username.value.trim() ||
    !email.value.trim() ||
    !password.value.trim() ||
    !passwordRepeat.value.trim()
  ) {
    errorMsg.value = "Bitte alle Felder ausfüllen.";
    return;
  }

  if (!email.value.includes("@")) {
    errorMsg.value = "Bitte geben Sie eine gültige E-Mail-Adresse ein.";
    return;
  }

  if (password.value !== passwordRepeat.value) {
    errorMsg.value = "Passwörter stimmen nicht überein.";
    return;
  }

  try {
    const newUser = await userStore.registerUser(
      username.value,
      email.value,
      password.value
    );
    if (newUser) {
      debugLog(
        "[RegisterView] user created",
        JSON.stringify({ id: newUser.id })
      );
      successMsg.value = `Benutzer ${username.value} wurde erfolgreich angelegt. Du kannst dich jetzt einloggen.`;
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } else {
      // This case might not be reachable if registerUser throws an error for existing user
      errorMsg.value =
        "Benutzername bereits vergeben oder ein anderer Fehler ist aufgetreten.";
      errorLog(
        "[RegisterView] registration failed, no newUser object returned",
        JSON.stringify({ user: username.value })
      );
    }
  } catch (err: any) {
    errorMsg.value =
      err.message || "Ein Fehler ist bei der Registrierung aufgetreten.";
    errorLog(
      "[RegisterView] registration error caught",
      JSON.stringify({
        user: username.value,
        error: err,
      })
    );
  }
}

function focusNext(
  field: "email" | "password" | "passwordRepeat" | "registerButton"
) {
  switch (field) {
    case "email":
      emailField.value?.focus();
      break;
    case "password":
      passwordField.value?.focus();
      break;
    case "passwordRepeat":
      passwordRepeatField.value?.focus();
      break;
    case "registerButton":
      registerButton.value?.focus();
      break;
  }
}
</script>

<template>
  <div class="flex items-center justify-center min-h-screen">
    <div class="card w-full max-w-md bg-base-100 border border-base-300 shadow">
      <div class="card-body space-y-4">
        <h2 class="text-xl font-bold text-center">Registrieren</h2>

        <div
          v-if="errorMsg"
          role="alert"
          class="alert alert-error alert-soft"
        >
          <span>{{ errorMsg }}</span>
        </div>
        <div
          v-if="successMsg"
          role="alert"
          class="alert alert-info alert-soft"
        >
          <span>{{ successMsg }}</span>
        </div>

        <input
          ref="usernameField"
          id="username"
          v-model.trim="username"
          type="text"
          placeholder="Benutzername"
          class="input input-bordered w-full"
          autocomplete="username"
          @keydown.enter.prevent="focusNext('email')"
          @keydown.tab.prevent="focusNext('email')"
        />
        <input
          ref="emailField"
          id="email"
          v-model.trim="email"
          type="email"
          placeholder="E-Mail (z.B. max.mustermann@example.com)"
          class="input input-bordered w-full"
          autocomplete="email"
          @keydown.enter.prevent="focusNext('password')"
          @keydown.tab.prevent="focusNext('password')"
        />
        <input
          ref="passwordField"
          id="password"
          v-model.trim="password"
          type="password"
          placeholder="Passwort"
          class="input input-bordered w-full"
          autocomplete="new-password"
          @keydown.enter.prevent="focusNext('passwordRepeat')"
          @keydown.tab.prevent="focusNext('passwordRepeat')"
        />
        <input
          ref="passwordRepeatField"
          id="passwordRepeat"
          v-model.trim="passwordRepeat"
          type="password"
          placeholder="Passwort wiederholen"
          class="input input-bordered w-full"
          autocomplete="new-password"
          @keydown.enter.prevent="onSubmit"
          @keydown.tab.prevent="focusNext('registerButton')"
        />

        <button
          ref="registerButton"
          id="registerButton"
          class="btn btn-primary w-full"
          @click="onSubmit"
        >
          Account anlegen
        </button>

        <div class="text-center text-sm opacity-70">
          Schon registriert?
          <router-link
            to="/login"
            class="link link-primary"
            >Zum Login</router-link
          >
        </div>
      </div>
    </div>
  </div>
</template>
