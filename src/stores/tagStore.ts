/**
 * Pfad: src/stores/tagStore.ts
 * Speichert Tags – jetzt tenant-spezifisch mit bidirektionaler Synchronisation.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import type { Tag, SyncQueueEntry } from '@/types';
import { SyncOperationType, EntityTypeEnum } from '@/types';
import { debugLog, errorLog, infoLog, warnLog } from '@/utils/logger';
import { TenantDbService } from '@/services/TenantDbService';

const stateColors = [
  'primary',
  'secondary',
  'accent',
  'info',
  'success',
  'warning',
  'error'
];

function getRandomStateColor(): string {
  const randomIndex = Math.floor(Math.random() * stateColors.length);
  return stateColors[randomIndex];
}

export const useTagStore = defineStore('tag', () => {
  const tenantDbService = new TenantDbService();

  const tags = ref<Tag[]>([]);
  const colorHistory = ref<string[]>([]);

  const getTagById = computed(() => (id: string) =>
    tags.value.find(t => t.id === id),
  );

  const rootTags = computed(() => {
    return tags.value.filter(tag => tag.parentTagId === null);
  });

  const getChildTags = computed(() => {
    return (parentId: string) => {
      return tags.value.filter(tag => tag.parentTagId === parentId);
    };
  });

  const getTagsByIds = computed(() => {
    return (ids: string[]) => tags.value.filter(tag => ids.includes(tag.id));
  });

  async function addTag(tagData: Omit<Tag, 'id' | 'updatedAt'> | Tag, fromSync = false): Promise<Tag> {

    const color = 'color' in tagData && tagData.color ? tagData.color : getRandomStateColor();
    const tagWithTimestamp: Tag = {
      ...tagData,
      // Generiere neue UUID wenn ID fehlt oder leer/falsy ist
      id: ('id' in tagData && tagData.id && tagData.id.trim()) ? tagData.id : uuidv4(),
      color,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updatedAt: (tagData as any).updatedAt || (tagData as any).updatedAt || new Date().toISOString(),
    };

    if (fromSync) {
      // LWW-Logik für eingehende Sync-Daten (CREATE)
      const localTag = await tenantDbService.getTagById(tagWithTimestamp.id);
      if (localTag && localTag.updatedAt && tagWithTimestamp.updatedAt &&
          new Date(localTag.updatedAt) >= new Date(tagWithTimestamp.updatedAt)) {
        infoLog('tagStore', `addTag (fromSync): Lokaler Tag ${localTag.id} ist neuer oder gleich aktuell. Eingehende Änderung verworfen.`);
        return localTag; // Gib den lokalen, "gewinnenden" Tag zurück
      }
      // Wenn eingehend neuer ist oder lokal nicht existiert, fahre fort mit DB-Update und Store-Update
      await tenantDbService.createTag(tagWithTimestamp); // createTag ist wie put, überschreibt wenn ID existiert
      infoLog('tagStore', `addTag (fromSync): Eingehender Tag ${tagWithTimestamp.id} angewendet (neuer oder lokal nicht vorhanden).`);
    } else { // Lokale Änderung (!fromSync)
      await tenantDbService.createTag(tagWithTimestamp);
    }

    const existingTagIndex = tags.value.findIndex(t => t.id === tagWithTimestamp.id);
    if (existingTagIndex === -1) {
      tags.value.push(tagWithTimestamp);
    } else {
      // Stelle sicher, dass auch hier die LWW-Logik für den Store gilt, falls die DB-Operation nicht sofort reflektiert wird
      if (!fromSync || (tagWithTimestamp.updatedAt && (!tags.value[existingTagIndex].updatedAt || new Date(tagWithTimestamp.updatedAt) > new Date(tags.value[existingTagIndex].updatedAt!)))) {
        tags.value[existingTagIndex] = tagWithTimestamp;
      } else if (fromSync) {
        // Wenn fromSync und das Store-Tag neuer ist, behalte das Store-Tag (sollte durch obige DB-Prüfung nicht passieren)
         warnLog('tagStore', `addTag (fromSync): Store-Tag ${tags.value[existingTagIndex].id} war neuer als eingehender ${tagWithTimestamp.id}. Store nicht geändert.`);
      }
    }
    infoLog('tagStore', `Tag "${tagWithTimestamp.name}" im Store hinzugefügt/aktualisiert (ID: ${tagWithTimestamp.id}).`);

    // ColorHistory-Management (nur bei lokalen Änderungen oder neuen Tags)
    if (!fromSync || existingTagIndex === -1) {
      await addColorToHistory(color);
    }

    // SyncQueue-Logik für alle lokalen Änderungen (konsistente Synchronisation)
    if (!fromSync) {
      try {
        // Feldmapping: updatedAt -> updated_at für Backend-Kompatibilität
        const backendPayload = {
          ...tenantDbService.toPlainObject(tagWithTimestamp),
          updated_at: tagWithTimestamp.updatedAt
        };
        // Entferne das Frontend-Feld
        delete (backendPayload as any).updatedAt;

        await tenantDbService.addSyncQueueEntry({
          entityType: EntityTypeEnum.TAG,
          entityId: tagWithTimestamp.id,
          operationType: SyncOperationType.CREATE,
          payload: backendPayload,
        });
        infoLog('tagStore', `Tag "${tagWithTimestamp.name}" zur Sync Queue hinzugefügt (CREATE).`);
      } catch (e) {
        errorLog('tagStore', `Fehler beim Hinzufügen von Tag "${tagWithTimestamp.name}" zur Sync Queue.`, e);
      }
    }
    return tagWithTimestamp;
  }

  async function updateTag(tagUpdatesData: Tag, fromSync = false): Promise<boolean> {

    const tagUpdatesWithTimestamp: Tag = {
      ...tagUpdatesData,
      updatedAt: tagUpdatesData.updatedAt || new Date().toISOString(),
    };

    if (fromSync) {
      // LWW-Logik für eingehende Sync-Daten (UPDATE)
      const localTag = await tenantDbService.getTagById(tagUpdatesWithTimestamp.id);
      if (!localTag) {
        // Tag existiert lokal nicht, also behandle es wie ein "CREATE" vom Sync
        infoLog('tagStore', `updateTag (fromSync): Lokaler Tag ${tagUpdatesWithTimestamp.id} nicht gefunden. Behandle als addTag.`);
        await addTag(tagUpdatesWithTimestamp, true); // Rufe addTag mit fromSync=true auf
        return true; // Frühzeitiger Ausstieg, da addTag die weitere Logik übernimmt
      }

      if (localTag.updatedAt && tagUpdatesWithTimestamp.updatedAt &&
          new Date(localTag.updatedAt) >= new Date(tagUpdatesWithTimestamp.updatedAt)) {
        infoLog('tagStore', `updateTag (fromSync): Lokaler Tag ${localTag.id} ist neuer oder gleich aktuell. Eingehende Änderung verworfen.`);
        return true; // Änderung verworfen, aber Operation als "erfolgreich" für den Sync-Handler betrachten
      }
      // Eingehend ist neuer, fahre fort mit DB-Update und Store-Update
      await tenantDbService.updateTag(tagUpdatesWithTimestamp.id, tagUpdatesWithTimestamp);
      infoLog('tagStore', `updateTag (fromSync): Eingehendes Update für Tag ${tagUpdatesWithTimestamp.id} angewendet.`);
    } else { // Lokale Änderung (!fromSync)
      await tenantDbService.updateTag(tagUpdatesWithTimestamp.id, tagUpdatesWithTimestamp);
    }

    const idx = tags.value.findIndex(t => t.id === tagUpdatesWithTimestamp.id);
    if (idx !== -1) {
      // Stelle sicher, dass auch hier die LWW-Logik für den Store gilt
      if (!fromSync || (tagUpdatesWithTimestamp.updatedAt && (!tags.value[idx].updatedAt || new Date(tagUpdatesWithTimestamp.updatedAt) > new Date(tags.value[idx].updatedAt!)))) {
        tags.value[idx] = { ...tags.value[idx], ...tagUpdatesWithTimestamp };

        // ColorHistory-Management (nur bei lokalen Änderungen oder wenn Farbe geändert wurde)
        if ((!fromSync || tagUpdatesWithTimestamp.color !== tags.value[idx].color) && tagUpdatesWithTimestamp.color) {
          await addColorToHistory(tagUpdatesWithTimestamp.color);
        }
      } else if (fromSync) {
        warnLog('tagStore', `updateTag (fromSync): Store-Tag ${tags.value[idx].id} war neuer als eingehender ${tagUpdatesWithTimestamp.id}. Store nicht geändert.`);
      }
      infoLog('tagStore', `Tag "${tagUpdatesWithTimestamp.name}" im Store aktualisiert (ID: ${tagUpdatesWithTimestamp.id}).`);

      // SyncQueue-Logik für alle lokalen Änderungen (konsistente Synchronisation)
      if (!fromSync) {
        try {
          // Feldmapping: updatedAt -> updated_at für Backend-Kompatibilität
          const backendPayload = {
            ...tenantDbService.toPlainObject(tagUpdatesWithTimestamp),
            updated_at: tagUpdatesWithTimestamp.updatedAt
          };
          // Entferne das Frontend-Feld
          delete (backendPayload as any).updatedAt;

          await tenantDbService.addSyncQueueEntry({
            entityType: EntityTypeEnum.TAG,
            entityId: tagUpdatesWithTimestamp.id,
            operationType: SyncOperationType.UPDATE,
            payload: backendPayload,
          });
          infoLog('tagStore', `Tag "${tagUpdatesWithTimestamp.name}" zur Sync Queue hinzugefügt (UPDATE).`);
        } catch (e) {
          errorLog('tagStore', `Fehler beim Hinzufügen von Tag Update "${tagUpdatesWithTimestamp.name}" zur Sync Queue.`, e);
        }
      }
      return true;
    }
    if (fromSync) {
      warnLog('tagStore', `updateTag: Tag ${tagUpdatesWithTimestamp.id} not found in store during sync. Adding it.`);
      await addTag(tagUpdatesWithTimestamp, true);
      return true;
    }
    return false;
  }

  async function deleteTag(tagId: string, fromSync = false): Promise<void> {
    const tagToDelete = tags.value.find(t => t.id === tagId);

    // Prüfe auf Child-Tags vor dem Löschen (nur bei lokalen Löschungen)
    if (!fromSync) {
      const hasChildren = tags.value.some(tag => tag.parentTagId === tagId);
      if (hasChildren) {
        warnLog('tagStore', `Tag mit ID "${tagId}" kann nicht gelöscht werden - hat Child-Tags`);
        throw new Error('Tag kann nicht gelöscht werden - hat Child-Tags');
      }
    }

    // Lokale DB immer zuerst (oder zumindest vor dem Hinzufügen zur SyncQueue) aktualisieren,
    // unabhängig davon, ob es vom Sync kommt oder eine lokale Änderung ist,
    // um den lokalen Zustand konsistent zu halten.
    // Die `fromSync`-Logik verhindert dann nur das erneute Senden an den Server.
    await tenantDbService.deleteTag(tagId);
    tags.value = tags.value.filter(t => t.id !== tagId);
    infoLog('tagStore', `Tag mit ID "${tagId}" aus Store und lokaler DB entfernt.`);

    // SyncQueue-Logik für alle lokalen Änderungen (konsistente Synchronisation)
    if (!fromSync && tagToDelete) {
      try {
        await tenantDbService.addSyncQueueEntry({
          entityType: EntityTypeEnum.TAG,
          entityId: tagId,
          operationType: SyncOperationType.DELETE,
          payload: { id: tagId }, // Nur ID bei Delete
        });
        infoLog('tagStore', `Tag mit ID "${tagId}" zur Sync Queue hinzugefügt (DELETE).`);
      } catch (e) {
        errorLog('tagStore', `Fehler beim Hinzufügen von Tag Delete (ID: "${tagId}") zur Sync Queue.`, e);
      }
    }
  }

  async function addColorToHistory(color: string) {
    try {
      if (!colorHistory.value.includes(color)) {
        colorHistory.value.unshift(color);
        if (colorHistory.value.length > 10) {
          colorHistory.value.pop();
        }
        await saveColorHistory();
      }
    } catch (error) {
      errorLog('tagStore', 'Fehler beim Hinzufügen der Farbe zur Historie', error);
    }
  }

  async function loadTags() {
    try {
      const loadedTags = await tenantDbService.getTags();
      tags.value = loadedTags;
      debugLog('tagStore', `${loadedTags.length} Tags aus IndexedDB geladen`);

      await loadColorHistory();
    } catch (error) {
      errorLog('tagStore', 'Fehler beim Laden der Tags aus IndexedDB', error);
      tags.value = [];
    }
  }

  async function saveColorHistory() {
    try {
      // ColorHistory wird in localStorage gespeichert, da es mandantenübergreifend ist
      localStorage.setItem('finwise_tag_colors', JSON.stringify(colorHistory.value));
    } catch (error) {
      errorLog('tagStore', 'Fehler beim Speichern der Farbhistorie', error);
    }
  }

  async function loadColorHistory() {
    try {
      const savedColors = localStorage.getItem('finwise_tag_colors');
      if (savedColors) {
        colorHistory.value = JSON.parse(savedColors);
      }
    } catch (error) {
      errorLog('tagStore', 'Fehler beim Laden der Farbhistorie', error);
      colorHistory.value = [];
    }
  }

  async function reset() {
    try {
      tags.value = [];
      colorHistory.value = [];
      await loadTags();
      debugLog('tagStore', 'TagStore zurückgesetzt und neu geladen');
    } catch (error) {
      errorLog('tagStore', 'Fehler beim Zurücksetzen des TagStores', error);
    }
  }

  // Initialisierung
  loadTags();

  return {
    tags,
    colorHistory,
    getTagById,
    rootTags,
    getChildTags,
    getTagsByIds,
    addTag,
    updateTag,
    deleteTag,
    loadTags,
    reset,
  };
});
