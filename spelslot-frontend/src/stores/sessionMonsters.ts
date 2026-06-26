import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { Monster } from '@/services/monsterService'

export interface MonsterTab {
  id: number
  label: string
  type: 'monster' | 'image'
  monster: Monster | null
  imageUrl: string | null
}

let nextId = 1

export const useSessionMonstersStore = defineStore('sessionMonsters', () => {
  const tabs = ref<MonsterTab[]>([])
  const activeId = ref<number | null>(null)

  const pinnedMonsters = computed(() =>
    tabs.value.filter(
      (t): t is MonsterTab & { monster: Monster } => t.type === 'monster' && t.monster !== null,
    ),
  )

  function addMonsterTab(monster: Monster): MonsterTab {
    const tab: MonsterTab = {
      id: nextId++,
      label: monster.name,
      type: 'monster',
      monster,
      imageUrl: null,
    }
    tabs.value.push(tab)
    activeId.value = tab.id
    return tab
  }

  function addImageTab(label: string, url: string): MonsterTab {
    const tab: MonsterTab = { id: nextId++, label, type: 'image', monster: null, imageUrl: url }
    tabs.value.push(tab)
    activeId.value = tab.id
    return tab
  }

  function removeTab(id: number) {
    const idx = tabs.value.findIndex((t) => t.id === id)
    if (idx === -1) return
    const tab = tabs.value[idx]
    if (tab.imageUrl) URL.revokeObjectURL(tab.imageUrl)
    tabs.value.splice(idx, 1)
    if (activeId.value === id) {
      activeId.value = tabs.value[Math.max(0, idx - 1)]?.id ?? null
    }
    if (tabs.value.length === 0) activeId.value = null
  }

  return { tabs, activeId, pinnedMonsters, addMonsterTab, addImageTab, removeTab }
})
