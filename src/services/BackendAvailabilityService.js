// src/services/BackendAvailabilityService.ts
import { ref, computed } from 'vue';
import { apiService } from '@/services/apiService';
import { debugLog } from '@/utils/logger';
// Globaler State für Backend-Verfügbarkeit
const isBackendOnline = ref(false);
const isCheckingBackend = ref(false);
const lastCheckTime = ref(0);
// Minimaler Abstand zwischen Checks (5 Sekunden)
const MIN_CHECK_INTERVAL = 5000;
/**
 * Backend-Verfügbarkeits-Service
 * Bietet eine zentrale HTTP-API-basierte Prüfung der Backend-Verfügbarkeit
 * Unabhängig von WebSocket-Verbindungen
 */
export const BackendAvailabilityService = {
    // Reactive State
    isOnline: computed(() => isBackendOnline.value),
    isChecking: computed(() => isCheckingBackend.value),
    /**
     * Prüft die Backend-Verfügbarkeit über HTTP-API
     */
    async checkAvailability(force = false) {
        const now = Date.now();
        // Verhindere zu häufige Checks
        if (!force && isCheckingBackend.value) {
            return isBackendOnline.value;
        }
        if (!force && (now - lastCheckTime.value) < MIN_CHECK_INTERVAL) {
            return isBackendOnline.value;
        }
        isCheckingBackend.value = true;
        lastCheckTime.value = now;
        try {
            await apiService.ping();
            isBackendOnline.value = true;
            debugLog('BackendAvailabilityService', 'Backend-Ping erfolgreich - Backend ist online');
            return true;
        }
        catch (error) {
            isBackendOnline.value = false;
            debugLog('BackendAvailabilityService', 'Backend-Ping fehlgeschlagen - Backend ist offline', error);
            return false;
        }
        finally {
            isCheckingBackend.value = false;
        }
    },
    /**
     * Startet periodische Backend-Checks
     */
    startPeriodicChecks(intervalMs = 30000) {
        // Initiale Prüfung
        this.checkAvailability(true);
        // Periodische Prüfung
        setInterval(() => {
            this.checkAvailability();
        }, intervalMs);
    },
    /**
     * Setzt den Backend-Status manuell (für Tests oder spezielle Fälle)
     */
    setStatus(online) {
        isBackendOnline.value = online;
    },
    /**
     * Computed für UI-Button-Status
     */
    get isButtonEnabled() {
        return computed(() => isBackendOnline.value);
    },
    /**
     * Hilfsfunktion für Tooltip-Text
     */
    getTooltipText(enabledText, checkingText = 'Backend-Status wird geprüft...', offlineText = 'Backend offline - Aktion nicht verfügbar') {
        if (isCheckingBackend.value)
            return checkingText;
        return isBackendOnline.value ? enabledText : offlineText;
    }
};
