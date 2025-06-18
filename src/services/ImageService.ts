import { apiService } from './apiService';
import { errorLog, infoLog } from '@/utils/logger';

// TypeScript hat Schwierigkeiten, import.meta.env ohne eine korrekte vite-env.d.ts Konfiguration zu erkennen.
// Für die Zwecke dieses Tasks wird eine Typ-Assertion verwendet.
// In einem vollständigen Projekt sollte sichergestellt werden, dass vite/client Typen global verfügbar sind.
const VITE_API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL as string;

export class ImageService {
  /**
   * Lädt ein Logo für eine Entität (Konto oder Kontengruppe) hoch.
   * @param entityId - Die ID der Entität.
   * @param entityType - Der Typ der Entität ('account' oder 'account_group').
   * @param file - Die hochzuladende Datei.
   * @returns Ein Promise, das bei Erfolg ein Objekt mit dem logo_path zurückgibt, sonst null.
   */
  static async uploadLogo(
    entityId: string,
    entityType: 'account' | 'account_group',
    file: File
  ): Promise<{ logo_path: string } | null> {
    const formData = new FormData();
    formData.append('entity_id', entityId);
    formData.append('entity_type', entityType);
    formData.append('file', file);

    const maxRetries = 3;
    const initialDelay = 1000; // ms

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Der Content-Type Header wird bei FormData automatisch vom Browser/Fetch-API gesetzt.
        // apiService.post sollte dies korrekt handhaben.
        // Annahme: apiService.post erwartet <ResponseType, RequestBodyType>
        const response = await apiService.post<{ logo_path: string }, FormData>(
          '/api/v1/logos/upload',
          formData,
          {
            // Explizit 'Content-Type': undefined setzen, falls apiService dies nicht automatisch handhabt
            // und stattdessen einen default JSON Content-Type setzt.
            // In den meisten modernen Fetch-basierten Clients ist dies nicht nötig.
            // Wenn apiService.post so konzipiert ist, dass es den Content-Type für FormData
            // automatisch korrekt setzt oder weglässt, ist dieser options-Block ggf. leer oder nicht notwendig.
          }
        );
        if (response) {
          return response;
        }
        // Wenn die Antwort null ist, aber kein Fehler ausgelöst wurde,
        // könnte dies ein unerwartetes Verhalten des apiService sein.
        // Für diesen Task behandeln wir es als Fehler und versuchen es erneut, falls zutreffend.
        // Oder wir geben direkt null zurück, wenn es kein Netzwerkfehler ist.
        // Hier gehen wir davon aus, dass ein null-Response ohne Fehler nicht retry-würdig ist.
        errorLog(
          'ImageService',
          `Unerwartete null-Antwort beim Hochladen des Logos für ${entityType} ${entityId} (Versuch ${attempt + 1})`
        );
        return null; // Oder spezifischere Behandlung
      } catch (error: any) {
        errorLog(
          'ImageService',
          `Fehler beim Hochladen des Logos für ${entityType} ${entityId} (Versuch ${attempt + 1}/${maxRetries}):`,
          error
        );

        // Prüfen, ob der Fehler einen Retry rechtfertigt
        // Dies ist eine vereinfachte Prüfung. In einer realen Anwendung würde man spezifischere Fehlercodes oder -typen prüfen.
        // z.B. error.status für HTTP-Fehler oder error.name für Netzwerkfehler
        const isNetworkError = error.message?.toLowerCase().includes('network error') || error.message?.toLowerCase().includes('failed to fetch');
        const isServerError = error.status && [500, 502, 503, 504].includes(error.status);

        if ((isNetworkError || isServerError) && attempt < maxRetries - 1) {
          const delay = initialDelay * Math.pow(2, attempt);
          infoLog(
            'ImageService',
            `Upload-Versuch ${attempt + 1} fehlgeschlagen. Nächster Versuch in ${delay}ms.`
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Kein Retry gerechtfertigt oder maximale Anzahl erreicht
          return null;
        }
      }
    }
    return null; // Sollte nicht erreicht werden, wenn maxRetries > 0
  }

  /**
   * Löscht ein Logo anhand seines Pfades.
   * @param logoPath - Der relative Pfad zum Logo (z.B. tenant_id/uuid.ext).
   * @returns Ein Promise, das true bei Erfolg zurückgibt, sonst false.
   */
  static async deleteLogo(logoPath: string): Promise<boolean> {
    if (!logoPath) {
      errorLog('ImageService', 'deleteLogo aufgerufen ohne logoPath.');
      return false;
    }
    try {
      // Der logoPath ist bereits der relative Pfad, der in der URL verwendet werden soll.
      // z.B. tenant_xyz/image.png
      await apiService.delete(`/api/v1/logos/${logoPath}`);
      return true;
    } catch (error) {
      errorLog(
        'ImageService',
        `Fehler beim Löschen des Logos unter Pfad ${logoPath}:`,
        error
      );
      return false;
    }
  }

  /**
   * Konstruiert die vollständige URL zum Abrufen eines Logos.
   * @param logoPath - Der relative Pfad zum Logo oder null/undefined.
   * @returns Die vollständige URL als String oder null, wenn kein logoPath vorhanden ist.
   */
  static getLogoUrl(logoPath: string | null | undefined): string | null {
    if (!logoPath) {
      return null;
    }
    // Stellt sicher, dass VITE_API_BASE_URL vorhanden ist und keinen abschließenden Schrägstrich hat,
    // während der logoPath keinen führenden Schrägstrich hat, um doppelte Schrägstriche zu vermeiden.
    // Der Backend-Endpunkt ist /api/v1/logos/{logoPath}
    // VITE_API_BASE_URL könnte z.B. http://localhost:8000 sein
    // logoPath ist z.B. tenant_id/uuid.ext
    // Die URL sollte also http://localhost:8000/api/v1/logos/tenant_id/uuid.ext sein.

    const baseUrl = VITE_API_BASE_URL?.replace(/\/$/, ''); // Entfernt abschließenden Slash, falls vorhanden
    const apiPrefix = '/api/v1/logos';
    const cleanLogoPath = logoPath.startsWith('/') ? logoPath.substring(1) : logoPath; // Entfernt führenden Slash, falls vorhanden

    if (!baseUrl) {
        errorLog('ImageService', 'VITE_API_BASE_URL ist nicht definiert.');
        return null;
    }

    return `${baseUrl}${apiPrefix}/${cleanLogoPath}`;
  }
}
