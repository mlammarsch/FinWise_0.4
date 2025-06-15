// src/test-settings-sync.ts
/**
 * Test-Script für vereinfachte Settings-Synchronisation
 * Kann in der Browser-Konsole ausgeführt werden
 */

import { useSettingsStore } from '@/stores/settingsStore';
import { useSessionStore } from '@/stores/sessionStore';
import { SettingsApiService } from '@/services/SettingsApiService';
import { LogLevel } from '@/utils/logger';

// Globale Test-Funktionen für Browser-Konsole
declare global {
  interface Window {
    testSettingsSync: () => Promise<void>;
    testSettingsLoad: () => Promise<void>;
    testSettingsReset: () => Promise<void>;
    testBackendAvailability: () => Promise<void>;
    showCurrentSettings: () => void;
    testOfflineMode: () => Promise<void>;
  }
}

/**
 * Testet die vereinfachte Settings-Synchronisation
 */
window.testSettingsSync = async function() {
  console.log('🧪 Teste vereinfachte Settings-Synchronisation...');

  const settingsStore = useSettingsStore();
  const sessionStore = useSessionStore();

  if (!sessionStore.currentUser?.id) {
    console.error('❌ Kein angemeldeter Benutzer gefunden');
    return;
  }

  try {
    // 1. Prüfe Backend-Verfügbarkeit
    const isBackendAvailable = await settingsStore.isBackendAvailable();
    console.log(`🌐 Backend verfügbar: ${isBackendAvailable ? '✅' : '❌'}`);

    // 2. Ändere Settings lokal
    console.log('📝 Ändere Settings lokal...');
    await settingsStore.setLoggerSettings(
      LogLevel.DEBUG,
      new Set(['store', 'ui', 'service', 'sync']),
      90
    );

    console.log('✅ Settings lokal geändert und automatisch synchronisiert');
    console.log('📊 Aktuelle Settings:', {
      logLevel: settingsStore.logLevel,
      categories: [...settingsStore.enabledLogCategories],
      retentionDays: settingsStore.historyRetentionDays
    });

    // 3. Teste localStorage-Persistierung
    const localData = localStorage.getItem('finwise_settings');
    console.log('💾 LocalStorage-Daten:', localData ? JSON.parse(localData) : 'Keine Daten');

  } catch (error) {
    console.error('❌ Fehler beim Testen der Settings-Sync:', error);
  }
};

/**
 * Testet das Laden von Settings (App-Start-Simulation)
 */
window.testSettingsLoad = async function() {
  console.log('🧪 Teste Settings-Load (App-Start-Simulation)...');

  const settingsStore = useSettingsStore();

  try {
    // Simuliere App-Start
    await settingsStore.loadFromStorage();
    console.log('✅ Settings erfolgreich geladen (lokal + Backend falls verfügbar)');
    console.log('📊 Geladene Settings:', {
      logLevel: settingsStore.logLevel,
      categories: [...settingsStore.enabledLogCategories],
      retentionDays: settingsStore.historyRetentionDays
    });
  } catch (error) {
    console.error('❌ Fehler beim Laden der Settings:', error);
  }
};

/**
 * Testet das Zurücksetzen der Settings
 */
window.testSettingsReset = async function() {
  console.log('🧪 Teste Settings-Reset...');

  const settingsStore = useSettingsStore();

  try {
    const isBackendAvailable = await settingsStore.isBackendAvailable();
    console.log(`🌐 Backend verfügbar für Reset: ${isBackendAvailable ? '✅' : '❌'}`);

    await settingsStore.resetToDefaults();
    console.log('✅ Settings erfolgreich zurückgesetzt (lokal + Backend falls verfügbar)');
    console.log('📊 Reset Settings:', {
      logLevel: settingsStore.logLevel,
      categories: [...settingsStore.enabledLogCategories],
      retentionDays: settingsStore.historyRetentionDays
    });
  } catch (error) {
    console.error('❌ Fehler beim Zurücksetzen der Settings:', error);
  }
};

/**
 * Testet die Backend-Verfügbarkeit
 */
window.testBackendAvailability = async function() {
  console.log('🧪 Teste Backend-Verfügbarkeit...');

  try {
    const isAvailable = await SettingsApiService.isBackendAvailable();
    console.log(isAvailable ? '✅ Backend ist verfügbar' : '❌ Backend ist nicht verfügbar');

    if (isAvailable) {
      const sessionStore = useSessionStore();
      if (sessionStore.currentUser?.id) {
        console.log('🔍 Teste direkten API-Call...');
        const settings = await SettingsApiService.getUserSettings(sessionStore.currentUser.id);
        console.log('✅ Direkte API-Antwort:', settings);
      }
    }
  } catch (error) {
    console.error('❌ Fehler beim Testen der Backend-Verfügbarkeit:', error);
  }
};

/**
 * Testet Offline-Modus (Backend nicht verfügbar)
 */
window.testOfflineMode = async function() {
  console.log('🧪 Teste Offline-Modus...');

  const settingsStore = useSettingsStore();

  try {
    // Simuliere Offline-Änderung
    console.log('📝 Ändere Settings im Offline-Modus...');

    // Temporär Backend-Check überschreiben
    const originalIsBackendAvailable = settingsStore.isBackendAvailable;
    settingsStore.isBackendAvailable = async () => false;

    await settingsStore.setLoggerSettings(
      LogLevel.WARN,
      new Set(['store', 'ui']),
      30
    );

    console.log('✅ Settings erfolgreich offline geändert');
    console.log('📊 Offline Settings:', {
      logLevel: settingsStore.logLevel,
      categories: [...settingsStore.enabledLogCategories],
      retentionDays: settingsStore.historyRetentionDays
    });

    // Prüfe localStorage
    const localData = localStorage.getItem('finwise_settings');
    console.log('💾 LocalStorage (Offline):', localData ? JSON.parse(localData) : 'Keine Daten');

    // Stelle ursprüngliche Funktion wieder her
    settingsStore.isBackendAvailable = originalIsBackendAvailable;

  } catch (error) {
    console.error('❌ Fehler beim Testen des Offline-Modus:', error);
  }
};

/**
 * Zeigt aktuelle Settings an
 */
window.showCurrentSettings = function() {
  const settingsStore = useSettingsStore();
  const sessionStore = useSessionStore();

  console.log('📊 Aktuelle Settings:', {
    user: sessionStore.currentUser?.id || 'Nicht angemeldet',
    logLevel: settingsStore.logLevel,
    categories: [...settingsStore.enabledLogCategories],
    retentionDays: settingsStore.historyRetentionDays
  });

  // Zeige auch localStorage-Daten
  const localData = localStorage.getItem('finwise_settings');
  console.log('💾 LocalStorage-Daten:', localData ? JSON.parse(localData) : 'Keine Daten');
};

// Automatische Registrierung beim Import
console.log('🔧 Vereinfachte Settings-Sync Test-Funktionen verfügbar:');
console.log('  - testSettingsSync() - Teste Settings-Änderung mit Auto-Sync');
console.log('  - testSettingsLoad() - Teste App-Start (lokal + Backend)');
console.log('  - testSettingsReset() - Teste Reset (lokal + Backend)');
console.log('  - testBackendAvailability() - Teste Backend-Verfügbarkeit');
console.log('  - testOfflineMode() - Teste Offline-Funktionalität');
console.log('  - showCurrentSettings() - Zeige aktuelle Settings');

export {};
