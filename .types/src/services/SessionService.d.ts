/**
 * SessionService – stellt Router-Guards & Initial-Bootstrapping bereit.
 */
import { Router } from 'vue-router';
export declare const SessionService: {
    /**
     * Richtet die globalen Router Guards ein.
     */
    setupGuards(router: Router): void;
    logoutAndRedirect(router: Router): void;
    /**
     * Vollständiger Logout mit IndexedDB-Bereinigung und Redirect
     * Wird bei Mandanten-Löschung verwendet
     */
    logoutWithCleanupAndRedirect(router: Router): Promise<void>;
    /**
     * Initialisiert Settings für den angemeldeten Benutzer
     * Lädt auch Logo-Cache wenn ein Mandant aktiv ist
     */
    initializeUserSettings(): Promise<void>;
    /**
     * Sammelt alle logoPath-Pfade und lädt die Bilder vom Backend in den logoCache
     * Wird beim Login und Mandantenwechsel aufgerufen
     */
    preloadLogosForTenant(): Promise<void>;
};
