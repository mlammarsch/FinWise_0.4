/**
 * Erzeugt einen mandanten- & user-spezifischen LocalStorage-Key.
 * Fallback „global“, wenn Session noch nicht initialisiert.
 */
export declare function storageKey(base: string): string;
