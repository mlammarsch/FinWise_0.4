// src/utils/auth.ts
import { debugLog, errorLog } from './logger';

// Einfache Funktion zum Dekodieren eines JWTs, um die Payload zu erhalten.
// WARNUNG: Dies verifiziert NICHT die Signatur des Tokens.
// Es sollte NUR verwendet werden, um nicht-sensible Daten wie die Benutzer-ID zu extrahieren.
// Die Token-Verifizierung sollte serverseitig erfolgen.
export function decodeJwt(token: string): unknown | null { // Changed any to unknown
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => { // Changed to arrow function
        return `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`; // Use padStart
    }).join(''));

    debugLog('authUtils', 'JWT decoded successfully.');
    return JSON.parse(jsonPayload);
  } catch (error) {
    errorLog('authUtils', 'Failed to decode JWT.', { error });
    return null;
  }
}

// TODO: Add functions for token storage (e.g., in localStorage or a secure cookie) if needed
