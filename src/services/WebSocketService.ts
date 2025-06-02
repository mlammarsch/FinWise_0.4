// src/services/WebSocketService.ts
import { useSessionStore } from '@/stores/sessionStore';
import { useWebSocketStore, WebSocketStatus } from '@/stores/webSocketStore';
import { infoLog, errorLog, debugLog } from '@/utils/logger';

const RECONNECT_INTERVAL = 5000; // 5 Sekunden
const MAX_RECONNECT_ATTEMPTS = 5;

let socket: WebSocket | null = null;
let reconnectAttempts = 0;
let explicitClose = false;

export const WebSocketService = {
  connect(): void {
    const sessionStore = useSessionStore();
    const webSocketStore = useWebSocketStore();

    if (socket && socket.readyState === WebSocket.OPEN) {
      infoLog('[WebSocketService]', 'Already connected.');
      return;
    }

    if (!sessionStore.currentTenantId) {
      errorLog('[WebSocketService]', 'Cannot connect: Tenant ID is missing.');
      webSocketStore.setError('Tenant ID is missing for WebSocket connection.');
      webSocketStore.setStatus(WebSocketStatus.ERROR);
      return;
    }

    const tenantId = sessionStore.currentTenantId;
    // Die Basis-URL für WebSockets muss ggf. konfigurierbar sein oder aus Umgebungsvariablen stammen.
    // Für lokale Entwicklung nehmen wir an, dass Backend und Frontend auf demselben Host laufen.
    // Das Backend läuft auf Port 8000 (Standard für FastAPI).
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname; // oder eine konfigurierte Backend-URL
    const wsPort = import.meta.env.VITE_BACKEND_PORT || '8000'; // Port des Backends
    const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}/ws_finwise/ws/${tenantId}`;

    explicitClose = false;
    webSocketStore.setStatus(WebSocketStatus.CONNECTING);
    infoLog('[WebSocketService]', `Connecting to ${wsUrl}`);

    try {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        infoLog('[WebSocketService]', 'Connected to WebSocket server.');
        webSocketStore.setStatus(WebSocketStatus.CONNECTED);
        webSocketStore.setError(null);
        reconnectAttempts = 0;
        // Hier könnte eine initiale Nachricht an den Server gesendet werden, falls erforderlich
        // this.sendMessage({ type: 'client_hello', tenantId });
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string);
          debugLog('[WebSocketService]', 'Message received:', message);
          webSocketStore.setLastMessage(message);

          // Grundlegende Nachrichtenbehandlung
          if (message.type === 'status_update') {
            if (message.status === 'backend_online') {
              infoLog('[WebSocketService]', 'Backend signaled: ONLINE');
              // Ggf. weitere Aktionen hier
            }
          }
          // Weitere Nachrichten-Typen hier behandeln (z.B. Datenänderungen)
          // if (message.type === 'data_update') {
          //   // Verarbeitung anstoßen, z.B. relevanten Store informieren
          // }

        } catch (e) {
          errorLog('[WebSocketService]', 'Error parsing message from server:', e, event.data);
          webSocketStore.setError('Error parsing message from server.');
        }
      };

      socket.onerror = (error) => {
        errorLog('[WebSocketService]', 'WebSocket error:', error);
        webSocketStore.setError('WebSocket connection error.');
        webSocketStore.setStatus(WebSocketStatus.ERROR);
        // Die onclose-Methode wird normalerweise nach einem Fehler auch aufgerufen.
      };

      socket.onclose = (event) => {
        infoLog('[WebSocketService]', `WebSocket closed. Code: ${event.code}, Reason: ${event.reason}, Clean: ${event.wasClean}`);
        webSocketStore.setStatus(WebSocketStatus.DISCONNECTED);
        socket = null;

        if (!explicitClose && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          infoLog('[WebSocketService]', `Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
          setTimeout(() => {
            this.connect();
          }, RECONNECT_INTERVAL);
        } else if (!explicitClose) {
          errorLog('[WebSocketService]', 'Max reconnect attempts reached. Will not try again automatically.');
          webSocketStore.setError('Max reconnect attempts reached.');
        }
      };
    } catch (error) {
      errorLog('[WebSocketService]', 'Failed to create WebSocket:', error);
      webSocketStore.setError('Failed to create WebSocket connection.');
      webSocketStore.setStatus(WebSocketStatus.ERROR);
    }
  },

  disconnect(): void {
    if (socket) {
      infoLog('[WebSocketService]', 'Disconnecting WebSocket explicitly.');
      explicitClose = true;
      socket.close();
    }
    // Der Store-Status wird durch onclose aktualisiert.
    // webSocketStore.reset(); // Optional, um den Store sofort zurückzusetzen
  },

  sendMessage(message: unknown): boolean {
    const webSocketStore = useWebSocketStore();
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        const jsonMessage = JSON.stringify(message);
        socket.send(jsonMessage);
        debugLog('[WebSocketService]', 'Message sent:', message);
        return true;
      } catch (error) {
        errorLog('[WebSocketService]', 'Error sending message:', error, message);
        webSocketStore.setError('Error sending message.');
        return false;
      }
    } else {
      errorLog('[WebSocketService]', 'Cannot send message: WebSocket is not connected.');
      webSocketStore.setError('Cannot send message: WebSocket is not connected.');
      return false;
    }
  },

  // Hilfsfunktion, um den aktuellen Status zu bekommen (optional)
  getStatus(): WebSocketStatus {
    return useWebSocketStore().status;
  },
};

// Automatische Verbindung beim Laden des Services, wenn ein Tenant ausgewählt ist.
// Dies kann auch an anderer Stelle in der Anwendung initiiert werden, z.B. nach dem Login oder Tenant-Wechsel.
// const session = useSessionStore();
// if (session.currentTenantId) {
//   WebSocketService.connect();
// }
