// src/stores/webSocketStore.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { infoLog, errorLog } from '@/utils/logger';
import { BackendStatus, type ServerWebSocketMessage } from '@/types';

export enum WebSocketConnectionStatus { // Umbenannt zur Klarheit
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
}

export const useWebSocketStore = defineStore('webSocket', () => {
  const connectionStatus = ref<WebSocketConnectionStatus>(WebSocketConnectionStatus.DISCONNECTED);
  const backendStatus = ref<BackendStatus>(BackendStatus.OFFLINE);
  const lastError = ref<string | null>(null);
  const lastMessage = ref<ServerWebSocketMessage | null>(null); // Typisiert mit ServerWebSocketMessage

  function setConnectionStatus(newStatus: WebSocketConnectionStatus) {
    infoLog('[WebSocketStore]', `Connection status changed to: ${newStatus}`);
    connectionStatus.value = newStatus;
    if (newStatus === WebSocketConnectionStatus.DISCONNECTED || newStatus === WebSocketConnectionStatus.ERROR) {
      // Wenn die Verbindung getrennt wird oder ein Fehler auftritt, ist das Backend nicht mehr zuverlässig erreichbar
      setBackendStatus(BackendStatus.OFFLINE);
    }
  }

  function setBackendStatus(newStatus: BackendStatus) {
    infoLog('[WebSocketStore]', `Backend status changed to: ${newStatus}`);
    backendStatus.value = newStatus;
  }

  function setError(errorMessage: string | null) {
    if (errorMessage) {
      errorLog('[WebSocketStore]', `Error: ${errorMessage}`);
    }
    lastError.value = errorMessage;
    if (errorMessage) {
      setConnectionStatus(WebSocketConnectionStatus.ERROR);
      // Backend-Status wird durch setConnectionStatus auf OFFLINE gesetzt
    }
  }

  function setLastMessage(message: ServerWebSocketMessage) {
    // infoLog('[WebSocketStore]', 'New message received:', message); // Kann sehr gesprächig sein
    lastMessage.value = message;
  }

  function reset() {
    setConnectionStatus(WebSocketConnectionStatus.DISCONNECTED);
    setBackendStatus(BackendStatus.OFFLINE); // Explizit auch hier setzen
    lastError.value = null;
    lastMessage.value = null;
  }

  return {
    connectionStatus,
    backendStatus,
    lastError,
    lastMessage,
    setConnectionStatus,
    setBackendStatus,
    setError,
    setLastMessage,
    reset,
  };
});
