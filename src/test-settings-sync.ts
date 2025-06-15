// src/test-settings-sync.ts
/**
 * Test-Script für Settings-Synchronisation
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
  }
}

/**
 * Testet die vollständige Settings-Synchronisation
 */
window.testSettingsSync = async function() {
  console.log('🧪 Teste Settings-Synchronisation...');

  const settingsStore = useSettingsStore();
  const sessionStore = useSessionStore();

  if (!sessionStore.currentUser?.id) {
    console.error('❌ Kein angemeldeter Benutzer gefunden');
    return;
  }

  try {
    // 1. Ändere Settings lokal
    console.log('📝 Ändere Settings lokal...');
    await settingsStore.setLoggerSettings(
      LogLevel.DEBUG,
      new Set(['store', 'ui', 'service', 'sync']),
      90
    );

    console.log('✅ Settings lokal geändert');
    console.log('📊 Aktuelle Settings:', {
      logLevel: settingsStore.logLevel,
      categories: [...settingsStore.enabledLogCategories],
      retentionDays: settingsStore.historyRetentionDays,
      lastSync: settingsStore.lastSyncTimestamp,
      isSyncing: settingsStore.isSyncing,
      syncError: settingsStore.syncError
    });

    // 2. Warte auf Sync-Completion
    let attempts = 0;
    while (settingsStore.isSyncing && attempts < 10) {
      console.log('⏳ Warte auf Sync-Completion...');
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }

    if (settingsStore.syncError) {
      console.error('❌ Sync-Fehler:', settingsStore.syncError);
    } else {
      console.log('✅ Settings erfolgreich synchronisiert');
    }

  } catch (error) {
    console.error('❌ Fehler beim Testen der Settings-Sync:', error);
  }
};

/**
 * Testet das Laden von Settings vom Backend
 */
window.testSettingsLoad = async function() {
  console.log('🧪 Teste Settings-Load vom Backend...');

  const settingsStore = useSettingsStore();

  try {
    await settingsStore.loadFromBackend();
    console.log('✅ Settings erfolgreich vom Backend geladen');
    console.log('📊 Geladene Settings:', {
      logLevel: settingsStore.logLevel,
      categories: [...settingsStore.enabledLogCategories],
      retentionDays: settingsStore.historyRetentionDays,
      lastSync: settingsStore.lastSyncTimestamp
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
    await settingsStore.resetToDefaults();
    console.log('✅ Settings erfolgreich zurückgesetzt');
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
 * Zeigt aktuelle Settings an
 */
window.showCurrentSettings = function() {
  const settingsStore = useSettingsStore();
  const sessionStore = useSessionStore();

  console.log('📊 Aktuelle Settings:', {
    user: sessionStore.currentUser?.id || 'Nicht angemeldet',
    logLevel: settingsStore.logLevel,
    categories: [...settingsStore.enabledLogCategories],
    retentionDays: settingsStore.historyRetentionDays,
    lastSync: settingsStore.lastSyncTimestamp,
    isSyncing: settingsStore.isSyncing,
    syncError: settingsStore.syncError
  });
};

// Automatische Registrierung beim Import
console.log('🔧 Settings-Sync Test-Funktionen verfügbar:');
console.log('  - testSettingsSync()');
console.log('  - testSettingsLoad()');
console.log('  - testSettingsReset()');
console.log('  - testBackendAvailability()');
console.log('  - showCurrentSettings()');

export {};
