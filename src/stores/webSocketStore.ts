// src/stores/webSocketStore.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { infoLog, errorLog } from '@/utils/logger';

export enum WebSocketStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
}

export const useWebSocketStore = defineStore('webSocket', () => {
  const status = ref<WebSocketStatus>(WebSocketStatus.DISCONNECTED);
  const lastError = ref<string | null>(null);
  const lastMessage = ref<unknown | null>(null); // Für eingehende Nachrichten

  function setStatus(newStatus: WebSocketStatus) {
    infoLog('[WebSocketStore]', `Status changed to: ${newStatus}`);
    status.value = newStatus;
  }

  function setError(errorMessage: string | null) {
    if (errorMessage) {
      errorLog('[WebSocketStore]', `Error: ${errorMessage}`);
    }
    lastError.value = errorMessage;
    if (errorMessage) {
      setStatus(WebSocketStatus.ERROR);
    }
  }

  function setLastMessage(message: unknown) {
    // infoLog('[WebSocketStore]', 'New message received:', message); // Kann sehr gesprächig sein
    lastMessage.value = message;
  }

  function reset() {
    status.value = WebSocketStatus.DISCONNECTED;
    lastError.value = null;
    lastMessage.value = null;
  }

  return {
    status,
    lastError,
    lastMessage,
    setStatus,
    setError,
    setLastMessage,
    reset,
  };
});
