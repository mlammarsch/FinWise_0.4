// src/services/UserService.ts
/**
 * UserService – Registrieren, Login, Passwort ändern, Logout.
 */
import { useUserStore } from '@/stores/userStore';
import { useSessionStore } from '@/stores/sessionStore';
import { infoLog, debugLog } from '@/utils/logger';
export const UserService = {
    /* ----------------------------------------------------- Registration */
    async register(username, email, password) {
        const userStore = useUserStore();
        const session = useSessionStore();
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
    async login(username, password) {
        const userStore = useUserStore();
        const session = useSessionStore();
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
    logout() {
        useSessionStore().logout();
    },
    /* ----------------------------------------------- Password Change */
    async changePassword(userId, newPassword) {
        return await useUserStore().changePassword(userId, newPassword);
    },
};
