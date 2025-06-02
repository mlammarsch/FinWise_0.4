// src/services/WebSocketService.ts
import { useSessionStore } from '@/stores/sessionStore';
import { useWebSocketStore, WebSocketConnectionStatus } from '@/stores/webSocketStore';
import { infoLog, errorLog, debugLog } from '@/utils/logger';
import { BackendStatus, type ServerWebSocketMessage, type StatusMessage } from '@/types';

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
      webSocketStore.setConnectionStatus(WebSocketConnectionStatus.ERROR);
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
    webSocketStore.setConnectionStatus(WebSocketConnectionStatus.CONNECTING);
    infoLog('[WebSocketService]', `Connecting to ${wsUrl}`);

    try {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        infoLog('[WebSocketService]', 'Connected to WebSocket server.');
        webSocketStore.setConnectionStatus(WebSocketConnectionStatus.CONNECTED);
        // Der Backend-Status wird durch eine explizite Nachricht vom Backend gesetzt.
        // Hier könnte man einen initialen "optimistischen" Status setzen oder auf die erste Statusnachricht warten.
        // webSocketStore.setBackendStatus(BackendStatus.ONLINE); // Vorerst nicht, warten auf Nachricht
        webSocketStore.setError(null);
        reconnectAttempts = 0;
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string) as ServerWebSocketMessage;
          debugLog('[WebSocketService]', 'Message received:', message);
          webSocketStore.setLastMessage(message);

          // Nachrichtenbehandlung für Backend-Status
          if (message.type === 'status') {
            const statusMessage = message as StatusMessage; // Type assertion
            infoLog('[WebSocketService]', `Backend status update: ${statusMessage.payload.status}`);
            webSocketStore.setBackendStatus(statusMessage.payload.status);
            if (statusMessage.payload.status === BackendStatus.ERROR && statusMessage.payload.message) {
              webSocketStore.setError(`Backend error: ${statusMessage.payload.message}`);
            }
          }
          // Hier weitere Nachrichten-Typen behandeln
          // z.B. if (message.type === 'data_update') { ... }

        } catch (e) {
          errorLog('[WebSocketService]', 'Error parsing message from server:', e, event.data);
          webSocketStore.setError('Error parsing message from server.');
          // Bei einem Parsing-Fehler könnte man den Backend-Status auf ERROR setzen
          webSocketStore.setBackendStatus(BackendStatus.ERROR);
        }
      };

      socket.onerror = (error) => {
        errorLog('[WebSocketService]', 'WebSocket error:', error);
        webSocketStore.setError('WebSocket connection error.');
        webSocketStore.setConnectionStatus(WebSocketConnectionStatus.ERROR);
        // Der Backend-Status wird durch setConnectionStatus auf OFFLINE gesetzt.
      };

      socket.onclose = (event) => {
        infoLog('[WebSocketService]', `WebSocket closed. Code: ${event.code}, Reason: ${event.reason}, Clean: ${event.wasClean}`);
        webSocketStore.setConnectionStatus(WebSocketConnectionStatus.DISCONNECTED);
        // Der Backend-Status wird durch setConnectionStatus auf OFFLINE gesetzt.
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
      webSocketStore.setConnectionStatus(WebSocketConnectionStatus.ERROR);
      // Der Backend-Status wird durch setConnectionStatus auf OFFLINE gesetzt.
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

  // Hilfsfunktion, um den aktuellen Verbindungsstatus zu bekommen (optional)
  getConnectionStatus(): WebSocketConnectionStatus {
    return useWebSocketStore().connectionStatus;
  },
  // Hilfsfunktion, um den aktuellen Backend-Status zu bekommen (optional)
  getBackendStatus(): BackendStatus {
    return useWebSocketStore().backendStatus;
  },
};

// Automatische Verbindung beim Laden des Services, wenn ein Tenant ausgewählt ist.
// Dies kann auch an anderer Stelle in der Anwendung initiiert werden, z.B. nach dem Login oder Tenant-Wechsel.
// const session = useSessionStore();
// if (session.currentTenantId) {
//   WebSocketService.connect();
// }
