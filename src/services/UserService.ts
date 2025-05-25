// src/services/UserService.ts
/**
 * UserService – Registrieren, Login, Passwort ändern, Logout.
 */

import { useUserStore } from '@/stores/userStore';
import { useSessionStore } from '@/stores/sessionStore';
import { infoLog, debugLog } from '@/utils/logger';

export const UserService = {
  /* ----------------------------------------------------- Registration */
  async register(username: string, email: string, password: string) {
    const userStore = useUserStore();
    const session   = useSessionStore();

    const newUser = await userStore.registerUser(username, email, password);
    if (newUser) {
      session.login(newUser.id);
      infoLog('[UserService]', 'User registriert & eingeloggt', {
        userId: newUser.id,
        username,
      });
    }
    return newUser;
  },

  /* ----------------------------------------------------------- Login */
  async login(username: string, password: string): Promise<boolean> {
    const userStore = useUserStore();
    const session   = useSessionStore();

    const user = await userStore.validateLogin(username, password);
    if (user) {
      session.login(user.id);
      infoLog('[UserService]', 'Login erfolgreich', { userId: user.id });
      return true;
    }
    debugLog('[UserService] login failed', { username });
    return false;
  },

  /* ---------------------------------------------------------- Logout */
  logout(): void {
    useSessionStore().logout();
  },

  /* ----------------------------------------------- Password Change */
  async changePassword(userId: string, newPassword: string): Promise<boolean> {
    return await useUserStore().changePassword(userId, newPassword);
  },
};
