// src/stores/userStore.ts
/**
 * Pfad zur Datei: src/stores/userStore.ts
 * Pinia-Store zum Verwalten aller lokalen User-Accounts.
 *
 * Enthält Registrierung, CRUD und Persistenz in LocalStorage.
 * Password-Hashing via bcryptjs, UUID via uuidv4.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';
import { debugLog } from '@/utils/logger';

export interface LocalUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  accessToken?: string;
  refreshToken?: string;
}

/** Konstante SaltRounds gemäß Anforderung 1 = 9 */
const SALT_ROUNDS = 9;

export const useUserStore = defineStore('user', () => {
  /* ------------------------------------------------------------------ State */
  const users = ref<LocalUser[]>([]);

  /* ---------------------------------------------------------------- Getter */
  const getUserById = computed(() => (id: string) =>
    users.value.find(u => u.id === id),
  );

  const getUserByUsername = computed(() => (username: string) =>
    users.value.find(
      u => u.username.toLowerCase() === username.toLowerCase(),
    ),
  );

  /* ---------------------------------------------------------------- Actions */
  /**
   * Registriert einen neuen User.
   * Password wird synchron gehasht; ergibt einen neuen User-Eintrag.
   */
  async function registerUser(
    username: string,
    email: string,
    plainPassword: string,
  ): Promise<LocalUser | null> {
    if (!username.trim() || !plainPassword.trim()) return null;
    if (getUserByUsername.value(username)) return null; // Username existiert

    const hash = await bcrypt.hash(plainPassword, SALT_ROUNDS);

    const now = new Date().toISOString();
    const newUser: LocalUser = {
      id: uuidv4(),
      username: username.trim(),
      email: email.trim(),
      passwordHash: hash,
      createdAt: now,
      updatedAt: now,
      accessToken: '',
      refreshToken: '',
    };

    users.value.push(newUser);
    saveUsers();

    debugLog('[userStore] registerUser', {
      id: newUser.id,
      username: newUser.username,
    });

    return newUser;
  }

  /**
   * Prüft Username + Password. Gibt User-Objekt oder null zurück.
   */
  async function validateLogin(
    username: string,
    plainPassword: string,
  ): Promise<LocalUser | null> {
    const user = getUserByUsername.value(username);
    if (!user) return null;

    const ok = await bcrypt.compare(plainPassword, user.passwordHash);
    return ok ? user : null;
  }

  /** Passwort ändern */
  async function changePassword(
    userId: string,
    newPlainPassword: string,
  ): Promise<boolean> {
    const idx = users.value.findIndex(u => u.id === userId);
    if (idx === -1) return false;

    const newHash = await bcrypt.hash(newPlainPassword, SALT_ROUNDS);
    users.value[idx].passwordHash = newHash;
    users.value[idx].updatedAt = new Date().toISOString();
    saveUsers();

    debugLog('[userStore] changePassword', { id: userId });
    return true;
  }

  /** Löscht User – wird von TenantService cascade-gelöscht */
  function deleteUser(userId: string): boolean {
    const before = users.value.length;
    users.value = users.value.filter(u => u.id !== userId);
    const removed = users.value.length < before;
    if (removed) {
      saveUsers();
      debugLog('[userStore] deleteUser', { id: userId });
    }
    return removed;
  }

  /* ---------------------------------------------------------- Persistence */
  function loadUsers(): void {
    const raw = localStorage.getItem('finwise_users');
    if (raw) {
      try {
        users.value = JSON.parse(raw);
      } catch {
        users.value = [];
      }
    }
    debugLog('[userStore] loadUsers', { count: users.value.length });
  }

  function saveUsers(): void {
    localStorage.setItem('finwise_users', JSON.stringify(users.value));
  }

  function reset(): void {
    users.value = [];
    loadUsers();
  }

  loadUsers();

  return {
    /* State */
    users,

    /* Getter */
    getUserById,
    getUserByUsername,

    /* Actions */
    registerUser,
    validateLogin,
    changePassword,
    deleteUser,
    loadUsers,
    reset,
  };
});
