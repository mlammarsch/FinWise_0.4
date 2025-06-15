// src/services/SettingsApiService.ts
import { debugLog, infoLog, errorLog } from '@/utils/logger';

const MODULE_NAME = 'SettingsApiService';
const BASE_URL = 'http://localhost:8000/api/v1/user';

export interface UserSettingsPayload {
  log_level: string;
  enabled_log_categories: string[];
  history_retention_days: number;
  updated_at?: string;
}

export interface UserSettingsResponse {
  id: string;
  user_id: string;
  log_level: string;
  enabled_log_categories: string[];
  history_retention_days: number;
  created_at: string;
  updated_at: string;
}

export class SettingsApiService {
  /**
   * Lädt Settings für einen Benutzer vom Backend
   */
  static async getUserSettings(userId: string): Promise<UserSettingsResponse> {
    debugLog(MODULE_NAME, `Lade Settings für User ${userId}`);

    try {
      const response = await fetch(`${BASE_URL}/settings/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const settings = await response.json();
      infoLog(MODULE_NAME, `Settings erfolgreich geladen für User ${userId}`);
      return settings;

    } catch (error) {
      errorLog(MODULE_NAME, `Fehler beim Laden der Settings für User ${userId}`, error);
      throw error;
    }
  }

  /**
   * Synchronisiert Settings mit dem Backend (Create oder Update)
   */
  static async syncUserSettings(
    userId: string,
    settingsPayload: UserSettingsPayload
  ): Promise<UserSettingsResponse> {
    debugLog(MODULE_NAME, `Synchronisiere Settings für User ${userId}`, {
      logLevel: settingsPayload.log_level,
      categoriesCount: settingsPayload.enabled_log_categories.length,
      retentionDays: settingsPayload.history_retention_days
    });

    try {
      const response = await fetch(`${BASE_URL}/settings/${userId}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settingsPayload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const settings = await response.json();
      infoLog(MODULE_NAME, `Settings erfolgreich synchronisiert für User ${userId}`);
      return settings;

    } catch (error) {
      errorLog(MODULE_NAME, `Fehler beim Synchronisieren der Settings für User ${userId}`, error);
      throw error;
    }
  }

  /**
   * Aktualisiert Settings im Backend
   */
  static async updateUserSettings(
    userId: string,
    settingsPayload: UserSettingsPayload
  ): Promise<UserSettingsResponse> {
    debugLog(MODULE_NAME, `Aktualisiere Settings für User ${userId}`);

    try {
      const response = await fetch(`${BASE_URL}/settings/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settingsPayload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const settings = await response.json();
      infoLog(MODULE_NAME, `Settings erfolgreich aktualisiert für User ${userId}`);
      return settings;

    } catch (error) {
      errorLog(MODULE_NAME, `Fehler beim Aktualisieren der Settings für User ${userId}`, error);
      throw error;
    }
  }

  /**
   * Setzt Settings auf Standardwerte zurück
   */
  static async resetUserSettings(userId: string): Promise<UserSettingsResponse> {
    debugLog(MODULE_NAME, `Setze Settings zurück für User ${userId}`);

    try {
      const response = await fetch(`${BASE_URL}/settings/${userId}/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const settings = await response.json();
      infoLog(MODULE_NAME, `Settings erfolgreich zurückgesetzt für User ${userId}`);
      return settings;

    } catch (error) {
      errorLog(MODULE_NAME, `Fehler beim Zurücksetzen der Settings für User ${userId}`, error);
      throw error;
    }
  }

  /**
   * Prüft ob das Backend erreichbar ist
   */
  static async isBackendAvailable(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:8000/ping', {
        method: 'GET',
        timeout: 5000 // 5 Sekunden Timeout
      } as RequestInit);

      return response.ok;
    } catch (error) {
      debugLog(MODULE_NAME, 'Backend nicht erreichbar', error);
      return false;
    }
  }

  /**
   * Wrapper für API-Calls mit Retry-Mechanismus
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === maxRetries) {
          break;
        }

        debugLog(MODULE_NAME, `Versuch ${attempt} fehlgeschlagen, wiederhole in ${delay}ms`, {
          error: lastError.message,
          attempt,
          maxRetries
        });

        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }

    throw lastError!;
  }
}
