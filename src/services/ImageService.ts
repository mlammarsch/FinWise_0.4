import { apiService } from './apiService';
import { errorLog, infoLog, debugLog } from '@/utils/logger';
import { TenantDbService } from './TenantDbService';
import { useTenantStore } from '@/stores/tenantStore'; // Import hinzugefügt

// TypeScript hat Schwierigkeiten, import.meta.env ohne eine korrekte vite-env.d.ts Konfiguration zu erkennen.
// Für die Zwecke dieses Tasks wird eine Typ-Assertion verwendet.
// In einem vollständigen Projekt sollte sichergestellt werden, dass vite/client Typen global verfügbar sind.
const VITE_API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL as string;

export class ImageService {
  /**
   * Lädt ein Bild hoch.
   * @param file - Die hochzuladende Datei.
   * @returns Ein Promise, das bei Erfolg ein Objekt mit dem image_url zurückgibt, sonst null.
   */
  static async uploadImage(
    file: File
  ): Promise<{ image_url: string } | null> {
    const formData = new FormData();
    formData.append('file', file);

    const maxRetries = 3;
    const initialDelay = 1000; // ms

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await apiService.post<{ image_url: string }, FormData>(
          '/api/v1/logos/upload', // Endpunkt ist jetzt /api/v1/logos/upload
          formData,
        );
        if (response) {
          return response;
        }
        errorLog(
          'ImageService',
          `Unerwartete null-Antwort beim Hochladen des Bildes (Versuch ${attempt + 1})`
        );
        return null;
      } catch (error: any) {
        errorLog(
          'ImageService',
          `Fehler beim Hochladen des Bildes (Versuch ${attempt + 1}/${maxRetries}):`,
          error
        );

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
          return null;
        }
      }
    }
    return null;
  }

  /**
   * Löscht ein Bild anhand seines Pfades.
   * @param imageUrl - Der relative Pfad zum Bild (z.B. tenant_id/uuid.ext).
   * @returns Ein Promise, das true bei Erfolg zurückgibt, sonst false.
   */
  static async deleteImage(imageUrl: string): Promise<boolean> {
    if (!imageUrl) {
      errorLog('ImageService', 'deleteImage aufgerufen ohne imageUrl.');
      return false;
    }

    const tenantStore = useTenantStore();
    const activeTenantId = tenantStore.activeTenantId;

    if (!activeTenantId) {
      errorLog('ImageService', 'Kein aktiver Tenant gefunden. Bild kann nicht gelöscht werden.');
      return false;
    }

    try {
      const pathParts = imageUrl.split('/');
      if (pathParts.length < 2) {
        errorLog('ImageService', `Ungültiges imageUrl-Format für Löschung: ${imageUrl}`);
        return false;
      }
      const fileName = pathParts[1]; // uuid.ext

      const deleteUrl = `/api/v1/logos/${activeTenantId}/${fileName}`; // Endpunkt ist jetzt /api/v1/logos/{tenant_id}/{file_name}
      debugLog('ImageService', `Versuche Bild zu löschen unter URL: ${deleteUrl}`);

      await apiService.delete(deleteUrl);
      return true;
    } catch (error) {
      errorLog(
        'ImageService',
        `Fehler beim Löschen des Bildes unter Pfad ${imageUrl}:`,
        error
      );
      return false;
    }
  }

  /**
   * Konstruiert die vollständige URL zum Abrufen eines Bildes.
   * @param imageUrl - Der relative Pfad zum Bild oder null/undefined.
   * @returns Die vollständige URL als String oder null, wenn kein imageUrl vorhanden ist.
   */
  static getImageUrl(imageUrl: string | null | undefined): string | null {
    if (!imageUrl) {
      return null;
    }

    const baseUrl = VITE_API_BASE_URL?.replace(/\/$/, '');
    const apiPrefix = '/api/v1/logos'; // Endpunkt ist jetzt /api/v1/logos
    const cleanImageUrl = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;

    if (!baseUrl) {
        errorLog('ImageService', 'VITE_API_BASE_URL ist nicht definiert.');
        return null;
    }

    return `${baseUrl}${apiPrefix}/${cleanImageUrl}`;
  }

  /**
   * Ruft ein Bild vom Backend ab, konvertiert es in eine Base64 Data URL und speichert es im Cache.
   * @param imageUrl - Der relative Pfad zum Bild.
   * @returns Die Base64 Data URL des Bildes oder null bei einem Fehler.
   */
  static async fetchAndCacheImage(imageUrl: string): Promise<string | null> {
    if (!imageUrl) {
      errorLog('ImageService', 'fetchAndCacheImage aufgerufen ohne imageUrl.');
      return null;
    }

    const tenantDbService = new TenantDbService();

    const fullImageUrl = ImageService.getImageUrl(imageUrl);

    if (!fullImageUrl) {
      errorLog('ImageService', `Konnte keine URL für imageUrl erstellen: ${imageUrl}`);
      return null;
    }

    try {
      debugLog('ImageService', `Versuche Bild abzurufen von: ${fullImageUrl}`);
      const response = await fetch(fullImageUrl);

      if (!response.ok) {
        errorLog(
          'ImageService',
          `Fehler beim Abrufen des Bildes von ${fullImageUrl}. Status: ${response.status} ${response.statusText}`
        );
        return null;
      }

      const blob = await response.blob();
      debugLog('ImageService', `Bild als Blob empfangen für: ${imageUrl}, Typ: ${blob.type}, Größe: ${blob.size}`);

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = (error) => {
          errorLog('ImageService', `Fehler beim Konvertieren des Blobs zu Base64 für ${imageUrl}`, error);
          reject(error);
        };
      });

      if (dataUrl) {
        debugLog('ImageService', `Bild erfolgreich zu Base64 konvertiert für: ${imageUrl}. Länge: ${dataUrl.length}`);
        await tenantDbService.cacheImage(imageUrl, dataUrl);
        infoLog('ImageService', `Bild für ${imageUrl} erfolgreich im Cache gespeichert.`);
        return dataUrl;
      }
      errorLog('ImageService', `Konvertierung zu Base64 für ${imageUrl} ergab null oder leeren String.`);
      return null;

    } catch (error) {
      errorLog('ImageService', `Allgemeiner Fehler in fetchAndCacheImage für ${imageUrl}:`, error);
      return null;
    }
  }
}
