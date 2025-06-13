/**
 * Store zur Verwaltung von Tags inklusive Farbe, Hierarchie und Persistenz.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { Tag, EntityTypeEnum, SyncOperationType } from '../types'
import { TenantDbService } from '@/services/TenantDbService'
import { debugLog, errorLog } from '@/utils/logger'

const stateColors = [
  'primary',
  'secondary',
  'accent',
  'info',
  'success',
  'warning',
  'error'
]

function getRandomStateColor(): string {
  const randomIndex = Math.floor(Math.random() * stateColors.length)
  return stateColors[randomIndex]
}

export const useTagStore = defineStore('tag', () => {
  const tags = ref<Tag[]>([])
  const colorHistory = ref<string[]>([])
  const tenantDbService = new TenantDbService()

  const getTagById = computed(() => {
    return (id: string) => tags.value.find(tag => tag.id === id)
  })

  const rootTags = computed(() => {
    return tags.value.filter(tag => tag.parentTagId === null)
  })

  const getChildTags = computed(() => {
    return (parentId: string) => {
      return tags.value.filter(tag => tag.parentTagId === parentId)
    }
  })

  const getTagsByIds = computed(() => {
    return (ids: string[]) => tags.value.filter(tag => ids.includes(tag.id))
  })

  async function addTag(tag: Omit<Tag, 'id'>, fromSync: boolean = false) {
    try {
      const color = tag.color || getRandomStateColor()
      const newTag: Tag = {
        ...tag,
        id: uuidv4(),
        color
      }

      const createdTag = await tenantDbService.createTag(newTag)
      tags.value.push(createdTag)
      addColorToHistory(color)

      if (!fromSync) {
        await tenantDbService.addSyncQueueEntry({
          entityType: EntityTypeEnum.TAG,
          entityId: createdTag.id,
          operationType: SyncOperationType.CREATE,
          payload: createdTag
        })
      }

      debugLog('TagStore', `Tag "${createdTag.name}" hinzugefügt`, { tag: createdTag })
      return createdTag
    } catch (error) {
      errorLog('TagStore', `Fehler beim Hinzufügen des Tags "${tag.name}"`, error)
      throw error
    }
  }

  async function updateTag(updatedTag: Tag, fromSync: boolean = false) {
    try {
      const success = await tenantDbService.updateTag(updatedTag.id, updatedTag)
      if (success) {
        const index = tags.value.findIndex(tag => tag.id === updatedTag.id)
        if (index !== -1) {
          tags.value[index] = { ...updatedTag }
          if (updatedTag.color) {
            addColorToHistory(updatedTag.color)
          }

          if (!fromSync) {
            await tenantDbService.addSyncQueueEntry({
              entityType: EntityTypeEnum.TAG,
              entityId: updatedTag.id,
              operationType: SyncOperationType.UPDATE,
              payload: updatedTag
            })
          }

          debugLog('TagStore', `Tag "${updatedTag.name}" aktualisiert`, { tag: updatedTag })
        }
      }
      return success
    } catch (error) {
      errorLog('TagStore', `Fehler beim Aktualisieren des Tags "${updatedTag.name}"`, error)
      throw error
    }
  }

  async function deleteTag(id: string, fromSync: boolean = false) {
    try {
      // Prüfe auf Child-Tags vor dem Löschen
      const hasChildren = tags.value.some(tag => tag.parentTagId === id)
      if (hasChildren) {
        debugLog('TagStore', `Tag mit ID "${id}" kann nicht gelöscht werden - hat Child-Tags`)
        return false
      }

      const success = await tenantDbService.deleteTag(id)
      if (success) {
        tags.value = tags.value.filter(tag => tag.id !== id)

        if (!fromSync) {
          await tenantDbService.addSyncQueueEntry({
            entityType: EntityTypeEnum.TAG,
            entityId: id,
            operationType: SyncOperationType.DELETE,
            payload: { id }
          })
        }

        debugLog('TagStore', `Tag mit ID "${id}" gelöscht`)
      }
      return success
    } catch (error) {
      errorLog('TagStore', `Fehler beim Löschen des Tags mit ID "${id}"`, error)
      throw error
    }
  }

  async function addColorToHistory(color: string) {
    try {
      if (!colorHistory.value.includes(color)) {
        colorHistory.value.unshift(color)
        if (colorHistory.value.length > 10) {
          colorHistory.value.pop()
        }
        await saveColorHistory()
      }
    } catch (error) {
      errorLog('TagStore', 'Fehler beim Hinzufügen der Farbe zur Historie', error)
    }
  }

  async function loadTags() {
    try {
      const loadedTags = await tenantDbService.getTags()
      tags.value = loadedTags
      debugLog('TagStore', `${loadedTags.length} Tags aus IndexedDB geladen`)

      await loadColorHistory()
    } catch (error) {
      errorLog('TagStore', 'Fehler beim Laden der Tags aus IndexedDB', error)
      tags.value = []
    }
  }

  async function saveColorHistory() {
    try {
      // ColorHistory wird in localStorage gespeichert, da es mandantenübergreifend ist
      localStorage.setItem('finwise_tag_colors', JSON.stringify(colorHistory.value))
    } catch (error) {
      errorLog('TagStore', 'Fehler beim Speichern der Farbhistorie', error)
    }
  }

  async function loadColorHistory() {
    try {
      const savedColors = localStorage.getItem('finwise_tag_colors')
      if (savedColors) {
        colorHistory.value = JSON.parse(savedColors)
      }
    } catch (error) {
      errorLog('TagStore', 'Fehler beim Laden der Farbhistorie', error)
      colorHistory.value = []
    }
  }

  async function reset() {
    try {
      tags.value = []
      colorHistory.value = []
      await loadTags()
      debugLog('TagStore', 'TagStore zurückgesetzt und neu geladen')
    } catch (error) {
      errorLog('TagStore', 'Fehler beim Zurücksetzen des TagStores', error)
    }
  }

  // Initialisierung
  loadTags()

  return {
    tags,
    getTagById,
    rootTags,
    getChildTags,
    getTagsByIds,
    addTag,
    updateTag,
    deleteTag,
    loadTags,
    reset,
    colorHistory
  }
})
