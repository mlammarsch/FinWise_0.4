/**
 * UserService – Registrieren, Login, Passwort ändern, Logout.
 */
export declare const UserService: {
    register(username: string, email: string, password: string): Promise<import("@/stores/userStore").LocalUser | null>;
    login(username: string, password: string): Promise<boolean>;
    logout(): void;
    changePassword(userId: string, newPassword: string): Promise<boolean>;
};
