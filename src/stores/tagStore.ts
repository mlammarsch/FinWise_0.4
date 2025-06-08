/**
 * Store zur Verwaltung von Tags inklusive Farbe, Hierarchie und Persistenz.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { Tag } from '../types'

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

  /**
   * Fügt einen neuen Tag hinzu.
   */
  function addTag(tag: Omit<Tag, 'id'>) {
    const newTag: Tag = {
      ...tag,
      id: uuidv4(),
      color: tag.color || getRandomStateColor()
    }
    tags.value.push(newTag)
    addColorToHistory(newTag.color)
    saveTags()
    return newTag
  }

  function updateTag(updatedTag: Tag) {
    const index = tags.value.findIndex(tag => tag.id === updatedTag.id)
    if (index !== -1) {
      tags.value[index] = { ...updatedTag }
      addColorToHistory(updatedTag.color)
      saveTags()
      return true
    }
    return false
  }

  function deleteTag(id: string) {
    const hasChildren = tags.value.some(tag => tag.parentTagId === id)
    if (hasChildren) {
      return false
    }

    tags.value = tags.value.filter(tag => tag.id !== id)
    saveTags()
    return true
  }

  function addColorToHistory(color: string) {
    if (!colorHistory.value.includes(color)) {
      colorHistory.value.unshift(color)
      if (colorHistory.value.length > 10) {
        colorHistory.value.pop()
      }
      saveColorHistory()
    }
  }

  function loadTags() {
    const savedTags = localStorage.getItem('finwise_tags')
    if (savedTags) {
      tags.value = JSON.parse(savedTags)
    }

    const savedColors = localStorage.getItem('finwise_tag_colors')
    if (savedColors) {
      colorHistory.value = JSON.parse(savedColors)
    }
  }

  function saveTags() {
    localStorage.setItem('finwise_tags', JSON.stringify(tags.value))
  }

  function saveColorHistory() {
    localStorage.setItem('finwise_tag_colors', JSON.stringify(colorHistory.value))
  }

  /**
   * Setzt den Store zurück und lädt gespeicherte Daten neu.
   */
  function reset() {
    tags.value = []
    loadTags()
  }

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
