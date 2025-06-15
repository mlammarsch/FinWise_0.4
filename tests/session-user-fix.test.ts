// tests/session-user-fix.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSessionStore } from '@/stores/sessionStore';
import { useUserStore, db } from '@/stores/userStore';
import { useTenantStore } from '@/stores/tenantStore';

// Mock logger
vi.mock('@/utils/logger', () => ({
  debugLog: vi.fn(),
  infoLog: vi.fn(),
  warnLog: vi.fn(),
  errorLog: vi.fn()
}));

// Mock TenantDbService
vi.mock('@/services/TenantDbService', () => ({
  TenantDbService: {
    getInstance: vi.fn().mockReturnValue({
      // Mock implementation
    })
  }
}));

describe('Session User Fix', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());

    // Clear IndexedDB
    await db.dbUsers.clear();
    await db.dbTenants.clear();
    await db.dbSession.clear();
  });

  it('should create default user when tenant exists but no user is logged in', async () => {
    const sessionStore = useSessionStore();
    const userStore = useUserStore();
    const tenantStore = useTenantStore();

    // Simuliere Zustand: Tenant vorhanden, aber kein User
    const testTenantId = 'test-tenant-123';

    // Erstelle Session-Daten mit Tenant aber ohne User
    await db.dbSession.put({
      id: 'currentSession',
      currentUserId: null,
      currentTenantId: testTenantId
    });

    // Erstelle einen Tenant in der DB
    await db.dbTenants.add({
      uuid: testTenantId,
      tenantName: 'Test Tenant',
      user_id: 'will-be-updated',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Mock tenantStore.setActiveTenant to return true
    vi.spyOn(tenantStore, 'setActiveTenant').mockResolvedValue(true);

    // Lade Session - sollte Default-User erstellen
    await sessionStore.loadSession();

    // Prüfe, dass ein User erstellt wurde
    expect(sessionStore.currentUserId).toBeTruthy();
    expect(sessionStore.currentTenantId).toBe(testTenantId);

    // Prüfe, dass User in DB existiert
    const users = await db.dbUsers.toArray();
    expect(users).toHaveLength(1);
    expect(users[0].username).toBe('Default User');
    expect(users[0].email).toBe('default@finwise.local');

    // Prüfe, dass Session gespeichert wurde
    const savedSession = await db.dbSession.get('currentSession');
    expect(savedSession?.currentUserId).toBeTruthy();
    expect(savedSession?.currentTenantId).toBe(testTenantId);
  });

  it('should use existing user when available instead of creating new one', async () => {
    const sessionStore = useSessionStore();
    const tenantStore = useTenantStore();

    // Erstelle existierenden User
    const existingUserId = 'existing-user-123';
    await db.dbUsers.add({
      uuid: existingUserId,
      username: 'Existing User',
      email: 'existing@test.com',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Simuliere Zustand: Tenant vorhanden, aber kein User in Session
    const testTenantId = 'test-tenant-456';
    await db.dbSession.put({
      id: 'currentSession',
      currentUserId: null,
      currentTenantId: testTenantId
    });

    // Mock tenantStore.setActiveTenant to return true
    vi.spyOn(tenantStore, 'setActiveTenant').mockResolvedValue(true);

    // Lade Session - sollte existierenden User verwenden
    await sessionStore.loadSession();

    // Prüfe, dass existierender User verwendet wurde
    expect(sessionStore.currentUserId).toBe(existingUserId);
    expect(sessionStore.currentTenantId).toBe(testTenantId);

    // Prüfe, dass nur ein User in DB existiert (kein neuer erstellt)
    const users = await db.dbUsers.toArray();
    expect(users).toHaveLength(1);
    expect(users[0].uuid).toBe(existingUserId);
  });

  it('should not create default user when user is already logged in', async () => {
    const sessionStore = useSessionStore();
    const tenantStore = useTenantStore();

    // Erstelle User und Session mit beiden IDs
    const userId = 'logged-in-user-123';
    const tenantId = 'tenant-789';

    await db.dbUsers.add({
      uuid: userId,
      username: 'Logged In User',
      email: 'loggedin@test.com',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await db.dbSession.put({
      id: 'currentSession',
      currentUserId: userId,
      currentTenantId: tenantId
    });

    // Mock tenantStore.setActiveTenant to return true
    vi.spyOn(tenantStore, 'setActiveTenant').mockResolvedValue(true);

    // Lade Session - sollte keine Änderungen vornehmen
    await sessionStore.loadSession();

    // Prüfe, dass Session korrekt geladen wurde
    expect(sessionStore.currentUserId).toBe(userId);
    expect(sessionStore.currentTenantId).toBe(tenantId);

    // Prüfe, dass nur ein User existiert (kein Default-User erstellt)
    const users = await db.dbUsers.toArray();
    expect(users).toHaveLength(1);
    expect(users[0].uuid).toBe(userId);
  });

  it('should handle ensureDefaultUser function directly', async () => {
    const sessionStore = useSessionStore();

    // Setze Tenant aber keinen User
    sessionStore.currentTenantId = 'direct-test-tenant';
    sessionStore.currentUserId = null;

    // Rufe ensureDefaultUser direkt auf
    await sessionStore.ensureDefaultUser();

    // Prüfe Ergebnis
    expect(sessionStore.currentUserId).toBeTruthy();
    expect(sessionStore.currentUserId).toMatch(/^default-user-\d+$/);

    // Prüfe DB
    const users = await db.dbUsers.toArray();
    expect(users).toHaveLength(1);
    expect(users[0].username).toBe('Default User');
  });
});
