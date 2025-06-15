// tests/settings-sync-simple.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSessionStore } from '@/stores/sessionStore';
import { SettingsApiService } from '@/services/SettingsApiService';
import { LogLevel } from '@/utils/logger';

// Mock SettingsApiService
vi.mock('@/services/SettingsApiService', () => ({
  SettingsApiService: {
    isBackendAvailable: vi.fn(),
    getUserSettings: vi.fn(),
    updateUserSettings: vi.fn(),
    resetUserSettings: vi.fn(),
  }
}));

// Mock sessionStore auf Modulebene nur mit der Struktur
// Die tatsächliche Implementierung wird in beforeEach gesetzt
vi.mock('@/stores/sessionStore', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    useSessionStore: vi.fn(),
  };
});

// Mock tenantStore to prevent localStorage errors
vi.mock('@/stores/tenantStore', () => ({
  useTenantStore: vi.fn(() => ({
    setActiveTenant: vi.fn(),
  }))
}));

// Mock logger
vi.mock('@/utils/logger', () => ({
  LogLevel: {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR'
  },
  LogConfig: {
    level: 'INFO',
    enabledCategories: new Set(['store', 'ui', 'service']),
    historyRetentionDays: 60
  },
  debugLog: vi.fn(),
  infoLog: vi.fn(),
  errorLog: vi.fn()
}));

describe('Vereinfachte Settings-Synchronisation', () => {
  let settingsStore: ReturnType<typeof useSettingsStore>;
  let localMockCurrentUser: { id: string; username: string } | null;

  beforeEach(() => {
    setActivePinia(createPinia());

    localMockCurrentUser = null; // Reset für jeden Test

    // Konfiguriere den Mock für useSessionStore für jeden Test neu
    // @ts-ignore
    vi.mocked(useSessionStore).mockImplementation(() => {
      return {
        get currentUser() { return localMockCurrentUser; },
        setCurrentUser: vi.fn((user) => { localMockCurrentUser = user; }),
        // Fügen Sie hier andere benötigte gemockte sessionStore Member hinzu
      } as any;
    });

    // settingsStore *nach* der Konfiguration des sessionStore Mocks initialisieren
    settingsStore = useSettingsStore();

    // Mocks für API-Aufrufe und localStorage zurücksetzen
    vi.clearAllMocks();

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });

    // Reset mocks
    vi.clearAllMocks();
  });

  describe('loadFromStorage', () => {
    it('sollte lokale Settings laden wenn kein Backend verfügbar', async () => {
      // Arrange
      const mockLocalData = {
        logLevel: LogLevel.DEBUG,
        enabledLogCategories: ['store', 'ui'],
        historyRetentionDays: 30
      };

      localStorage.getItem = vi.fn().mockReturnValue(JSON.stringify(mockLocalData));
      SettingsApiService.isBackendAvailable = vi.fn().mockResolvedValue(false);

      // Act
      await settingsStore.loadFromStorage();

      // Assert
      expect(settingsStore.logLevel).toBe(LogLevel.DEBUG);
      expect([...settingsStore.enabledLogCategories]).toEqual(['store', 'ui']);
      expect(settingsStore.historyRetentionDays).toBe(30);
      expect(SettingsApiService.getUserSettings).not.toHaveBeenCalled();
    });

    it('sollte Backend-Settings laden und lokale überschreiben wenn Backend verfügbar', async () => {
      // Arrange
      const mockLocalData = {
        logLevel: LogLevel.INFO,
        enabledLogCategories: ['store'],
        historyRetentionDays: 60
      };

      const mockBackendData = {
        id: '1',
        user_id: 'user123',
        log_level: 'DEBUG',
        enabled_log_categories: ['store', 'ui', 'service'],
        history_retention_days: 90,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z'
      };

      localStorage.getItem = vi.fn().mockReturnValue(JSON.stringify(mockLocalData));
      localMockCurrentUser = { id: 'user123', username: 'testuser' };
      SettingsApiService.isBackendAvailable = vi.fn().mockResolvedValue(true);
      SettingsApiService.getUserSettings = vi.fn().mockResolvedValue(mockBackendData);

      // Act
      await settingsStore.loadFromStorage();

      // Assert
      expect(settingsStore.logLevel).toBe(LogLevel.DEBUG);
      expect([...settingsStore.enabledLogCategories]).toEqual(['store', 'ui', 'service']);
      expect(settingsStore.historyRetentionDays).toBe(90);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'finwise_settings',
        JSON.stringify({
          logLevel: LogLevel.DEBUG,
          enabledLogCategories: ['store', 'ui', 'service'],
          historyRetentionDays: 90
        })
      );
    });

    it('sollte graceful fallback zu lokalen Settings bei Backend-Fehler', async () => {
      // Arrange
      const mockLocalData = {
        logLevel: LogLevel.INFO,
        enabledLogCategories: ['store'],
        historyRetentionDays: 60
      };

      localStorage.getItem = vi.fn().mockReturnValue(JSON.stringify(mockLocalData));
      localMockCurrentUser = { id: 'user123', username: 'testuser' };
      SettingsApiService.isBackendAvailable = vi.fn().mockResolvedValue(true);
      SettingsApiService.getUserSettings = vi.fn().mockRejectedValue(new Error('Network error'));

      // Act
      await settingsStore.loadFromStorage();

      // Assert
      expect(settingsStore.logLevel).toBe(LogLevel.INFO);
      expect([...settingsStore.enabledLogCategories]).toEqual(['store']);
      expect(settingsStore.historyRetentionDays).toBe(60);
    });
  });

  describe('saveToStorage', () => {
    it('sollte Settings lokal speichern wenn kein Backend verfügbar', async () => {
      // Arrange
      settingsStore.logLevel = LogLevel.WARN;
      settingsStore.enabledLogCategories = new Set(['store', 'ui']);
      settingsStore.historyRetentionDays = 45;

      SettingsApiService.isBackendAvailable = vi.fn().mockResolvedValue(false);

      // Act
      await settingsStore.saveToStorage();

      // Assert
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'finwise_settings',
        JSON.stringify({
          logLevel: LogLevel.WARN,
          enabledLogCategories: ['store', 'ui'],
          historyRetentionDays: 45
        })
      );
      expect(SettingsApiService.updateUserSettings).not.toHaveBeenCalled();
    });

    it('sollte Settings lokal speichern und an Backend senden wenn verfügbar', async () => {
      // Arrange
      settingsStore.logLevel = LogLevel.ERROR;
      settingsStore.enabledLogCategories = new Set(['store']);
      settingsStore.historyRetentionDays = 30;

      localMockCurrentUser = { id: 'user123', username: 'testuser' };
      SettingsApiService.isBackendAvailable = vi.fn().mockResolvedValue(true);
      SettingsApiService.updateUserSettings = vi.fn().mockResolvedValue({
        id: '1',
        user_id: 'user123',
        log_level: 'ERROR',
        enabled_log_categories: ['store'],
        history_retention_days: 30,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z'
      });

      // Act
      await settingsStore.saveToStorage();

      // Assert
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'finwise_settings',
        JSON.stringify({
          logLevel: LogLevel.ERROR,
          enabledLogCategories: ['store'],
          historyRetentionDays: 30
        })
      );
      expect(SettingsApiService.updateUserSettings).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          log_level: 'ERROR',
          enabled_log_categories: ['store'],
          history_retention_days: 30
        })
      );
    });

    it('sollte lokale Settings behalten bei Backend-Fehler', async () => {
      // Arrange
      settingsStore.logLevel = LogLevel.DEBUG;
      settingsStore.enabledLogCategories = new Set(['store', 'ui', 'service']);
      settingsStore.historyRetentionDays = 120;

      localMockCurrentUser = { id: 'user123', username: 'testuser' };
      SettingsApiService.isBackendAvailable = vi.fn().mockResolvedValue(true);
      SettingsApiService.updateUserSettings = vi.fn().mockRejectedValue(new Error('Server error'));

      // Act
      await settingsStore.saveToStorage();

      // Assert
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'finwise_settings',
        JSON.stringify({
          logLevel: LogLevel.DEBUG,
          enabledLogCategories: ['store', 'ui', 'service'],
          historyRetentionDays: 120
        })
      );
      // Settings sollten trotz Backend-Fehler lokal gespeichert bleiben
      expect(settingsStore.logLevel).toBe(LogLevel.DEBUG);
    });
  });

  describe('resetToDefaults', () => {
    it('sollte Settings auf Defaults zurücksetzen (nur lokal wenn Backend nicht verfügbar)', async () => {
      // Arrange
      settingsStore.logLevel = LogLevel.DEBUG;
      settingsStore.enabledLogCategories = new Set(['store', 'ui', 'service', 'sync']);
      settingsStore.historyRetentionDays = 120;

      SettingsApiService.isBackendAvailable = vi.fn().mockResolvedValue(false);

      // Act
      await settingsStore.resetToDefaults();

      // Assert
      expect(settingsStore.logLevel).toBe(LogLevel.INFO);
      expect([...settingsStore.enabledLogCategories]).toEqual(['store', 'ui', 'service']);
      expect(settingsStore.historyRetentionDays).toBe(60);
      expect(SettingsApiService.resetUserSettings).not.toHaveBeenCalled();
    });

    it('sollte Settings lokal und im Backend zurücksetzen wenn verfügbar', async () => {
      // Arrange
      settingsStore.logLevel = LogLevel.DEBUG;
      settingsStore.enabledLogCategories = new Set(['store', 'ui', 'service', 'sync']);
      settingsStore.historyRetentionDays = 120;

      localMockCurrentUser = { id: 'user123', username: 'testuser' };
      SettingsApiService.isBackendAvailable = vi.fn().mockResolvedValue(true);
      SettingsApiService.resetUserSettings = vi.fn().mockResolvedValue({
        id: '1',
        user_id: 'user123',
        log_level: 'INFO',
        enabled_log_categories: ['store', 'ui', 'service'],
        history_retention_days: 60,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z'
      });

      // Act
      await settingsStore.resetToDefaults();

      // Assert
      expect(settingsStore.logLevel).toBe(LogLevel.INFO);
      expect([...settingsStore.enabledLogCategories]).toEqual(['store', 'ui', 'service']);
      expect(settingsStore.historyRetentionDays).toBe(60);
      expect(SettingsApiService.resetUserSettings).toHaveBeenCalledWith('user123');
    });
  });

  describe('setLoggerSettings', () => {
    it('sollte Logger Settings setzen und automatisch speichern', async () => {
      // Arrange
      const newCategories = new Set(['store', 'ui', 'debug']);
      SettingsApiService.isBackendAvailable = vi.fn().mockResolvedValue(false);

      // Act
      await settingsStore.setLoggerSettings(LogLevel.DEBUG, newCategories, 90);

      // Assert
      expect(settingsStore.logLevel).toBe(LogLevel.DEBUG);
      expect([...settingsStore.enabledLogCategories]).toEqual(['store', 'ui', 'debug']);
      expect(settingsStore.historyRetentionDays).toBe(90);
      expect(localStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('isBackendAvailable', () => {
    it('sollte Backend-Verfügbarkeit korrekt prüfen', async () => {
      // Arrange
      SettingsApiService.isBackendAvailable = vi.fn().mockResolvedValue(true);

      // Act
      const result = await settingsStore.isBackendAvailable();

      // Assert
      expect(result).toBe(true);
      expect(SettingsApiService.isBackendAvailable).toHaveBeenCalled();
    });
  });
});
