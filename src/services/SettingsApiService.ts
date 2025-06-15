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
}
