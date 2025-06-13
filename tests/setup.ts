/**
 * Vitest Setup-Datei für Integration Tests
 * Konfiguriert die Test-Umgebung für IndexedDB-Mocking und Store-Setup
 */

import { vi } from 'vitest';
import 'fake-indexeddb/auto';

// Mock für WebSocket
const MockWebSocket = function(this: any, url: string) {
  this.url = url;
  this.readyState = 0; // CONNECTING
  this.send = vi.fn();
  this.close = vi.fn();
  this.addEventListener = vi.fn();
  this.removeEventListener = vi.fn();
  this.onopen = null;
  this.onclose = null;
  this.onmessage = null;
  this.onerror = null;
} as any;

MockWebSocket.CONNECTING = 0;
MockWebSocket.OPEN = 1;
MockWebSocket.CLOSING = 2;
MockWebSocket.CLOSED = 3;

global.WebSocket = MockWebSocket;

// Mock für window.location
Object.defineProperty(window, 'location', {
  value: {
    protocol: 'http:',
    hostname: 'localhost',
    port: '3000',
  },
  writable: true,
});

// Mock für import.meta.env
vi.stubGlobal('import.meta', {
  env: {
    VITE_BACKEND_PORT: '8000',
  },
});

// Console-Mocks für saubere Test-Ausgabe
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
