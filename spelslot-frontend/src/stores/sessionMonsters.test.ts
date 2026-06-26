import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Monster } from '@/services/monsterService'

// ── Globals ──────────────────────────────────────────────────────────────────

vi.stubGlobal('URL', { revokeObjectURL: vi.fn() })

import { useSessionMonstersStore } from './sessionMonsters'

// ── Fixture factory ──────────────────────────────────────────────────────────

function makeMonster(overrides: Partial<Monster> = {}): Monster {
  return {
    slug: 'goblin',
    name: 'Goblin',
    size: 'Small',
    type: 'humanoid',
    subtype: 'goblinoid',
    alignment: 'neutral evil',
    armor_class: 15,
    armor_desc: 'leather armor, shield',
    hit_points: 7,
    hit_dice: '2d6',
    speed: { walk: 30 },
    strength: 8,
    dexterity: 14,
    constitution: 10,
    intelligence: 10,
    wisdom: 8,
    charisma: 8,
    strength_save: null,
    dexterity_save: null,
    constitution_save: null,
    intelligence_save: null,
    wisdom_save: null,
    charisma_save: null,
    perception: null,
    skills: {},
    damage_vulnerabilities: '',
    damage_resistances: '',
    damage_immunities: '',
    condition_immunities: '',
    senses: 'darkvision 60 ft.',
    languages: 'Common, Goblin',
    challenge_rating: '1/4',
    cr: 0.25,
    actions: [],
    reactions: [],
    legendary_actions: [],
    special_abilities: [],
    document__title: 'SRD',
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useSessionMonstersStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  // ── initial state ──────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('should have an empty tabs array', () => {
      const store = useSessionMonstersStore()
      expect(store.tabs).toEqual([])
    })

    it('should have activeId as null', () => {
      const store = useSessionMonstersStore()
      expect(store.activeId).toBeNull()
    })
  })

  // ── addMonsterTab ──────────────────────────────────────────────────────────

  describe('addMonsterTab', () => {
    it('should add a tab to the tabs array', () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const store = useSessionMonstersStore()
      const monster = makeMonster()

      // ── act ───────────────────────────────────────────────────────────────
      store.addMonsterTab(monster)

      // ── assert ────────────────────────────────────────────────────────────
      expect(store.tabs).toHaveLength(1)
      expect(store.tabs[0].type).toBe('monster')
      expect(store.tabs[0].monster).toEqual(monster)
    })

    it('should set activeId to the new tab id', () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const store = useSessionMonstersStore()
      const monster = makeMonster()

      // ── act ───────────────────────────────────────────────────────────────
      const tab = store.addMonsterTab(monster)

      // ── assert ────────────────────────────────────────────────────────────
      expect(store.activeId).toBe(tab.id)
    })

    it('should return the created tab object', () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const store = useSessionMonstersStore()
      const monster = makeMonster({ name: 'Orc' })

      // ── act ───────────────────────────────────────────────────────────────
      const tab = store.addMonsterTab(monster)

      // ── assert ────────────────────────────────────────────────────────────
      expect(tab.label).toBe('Orc')
      expect(tab.type).toBe('monster')
      expect(tab.imageUrl).toBeNull()
    })
  })

  // ── addImageTab ────────────────────────────────────────────────────────────

  describe('addImageTab', () => {
    it('should add an image tab with the given label and url', () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const store = useSessionMonstersStore()

      // ── act ───────────────────────────────────────────────────────────────
      const tab = store.addImageTab('Dragon Art', 'blob:http://localhost/abc')

      // ── assert ────────────────────────────────────────────────────────────
      expect(store.tabs).toHaveLength(1)
      expect(tab.type).toBe('image')
      expect(tab.label).toBe('Dragon Art')
      expect(tab.imageUrl).toBe('blob:http://localhost/abc')
      expect(tab.monster).toBeNull()
    })

    it('should set activeId to the new image tab id', () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const store = useSessionMonstersStore()

      // ── act ───────────────────────────────────────────────────────────────
      const tab = store.addImageTab('Map', 'blob:http://localhost/map')

      // ── assert ────────────────────────────────────────────────────────────
      expect(store.activeId).toBe(tab.id)
    })
  })

  // ── pinnedMonsters ─────────────────────────────────────────────────────────

  describe('pinnedMonsters', () => {
    it('should only include monster tabs, not image tabs', () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const store = useSessionMonstersStore()
      store.addMonsterTab(makeMonster({ name: 'Goblin' }))
      store.addImageTab('Art', 'blob:http://localhost/art')
      store.addMonsterTab(makeMonster({ name: 'Orc' }))

      // ── act + assert ──────────────────────────────────────────────────────
      expect(store.pinnedMonsters).toHaveLength(2)
      expect(store.pinnedMonsters.every((t) => t.type === 'monster')).toBe(true)
    })

    it('should be empty when there are only image tabs', () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const store = useSessionMonstersStore()
      store.addImageTab('Art', 'blob:http://localhost/art')

      // ── act + assert ──────────────────────────────────────────────────────
      expect(store.pinnedMonsters).toHaveLength(0)
    })
  })

  // ── removeTab ─────────────────────────────────────────────────────────────

  describe('removeTab', () => {
    it('should remove the tab with the matching id', () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const store = useSessionMonstersStore()
      const tab = store.addMonsterTab(makeMonster())

      // ── act ───────────────────────────────────────────────────────────────
      store.removeTab(tab.id)

      // ── assert ────────────────────────────────────────────────────────────
      expect(store.tabs).toHaveLength(0)
    })

    it('should set activeId to the previous tab when the active tab is removed', () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const store = useSessionMonstersStore()
      const first = store.addMonsterTab(makeMonster({ name: 'First' }))
      const second = store.addMonsterTab(makeMonster({ name: 'Second' }))
      expect(store.activeId).toBe(second.id)

      // ── act ───────────────────────────────────────────────────────────────
      store.removeTab(second.id)

      // ── assert ────────────────────────────────────────────────────────────
      expect(store.activeId).toBe(first.id)
    })

    it('should set activeId to null when the last tab is removed', () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const store = useSessionMonstersStore()
      const tab = store.addMonsterTab(makeMonster())

      // ── act ───────────────────────────────────────────────────────────────
      store.removeTab(tab.id)

      // ── assert ────────────────────────────────────────────────────────────
      expect(store.activeId).toBeNull()
    })

    it('should call URL.revokeObjectURL when removing an image tab', () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const store = useSessionMonstersStore()
      const imageUrl = 'blob:http://localhost/image'
      const tab = store.addImageTab('Art', imageUrl)

      // ── act ───────────────────────────────────────────────────────────────
      store.removeTab(tab.id)

      // ── assert ────────────────────────────────────────────────────────────
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(imageUrl)
    })

    it('should not call URL.revokeObjectURL when removing a monster tab', () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const store = useSessionMonstersStore()
      const tab = store.addMonsterTab(makeMonster())

      // ── act ───────────────────────────────────────────────────────────────
      store.removeTab(tab.id)

      // ── assert ────────────────────────────────────────────────────────────
      expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    })

    it('should not change activeId when a non-active tab is removed', () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const store = useSessionMonstersStore()
      const first = store.addMonsterTab(makeMonster({ name: 'First' }))
      const second = store.addMonsterTab(makeMonster({ name: 'Second' }))
      expect(store.activeId).toBe(second.id)

      // ── act ───────────────────────────────────────────────────────────────
      store.removeTab(first.id)

      // ── assert ────────────────────────────────────────────────────────────
      expect(store.activeId).toBe(second.id)
    })
  })

  // ── removeTab nonexistent ──────────────────────────────────────────────────

  describe('removeTab nonexistent', () => {
    it('should do nothing when the id is not found', () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const store = useSessionMonstersStore()
      const tab = store.addMonsterTab(makeMonster())
      const originalActiveId = store.activeId

      // ── act ───────────────────────────────────────────────────────────────
      store.removeTab(tab.id + 9999)

      // ── assert ────────────────────────────────────────────────────────────
      expect(store.tabs).toHaveLength(1)
      expect(store.activeId).toBe(originalActiveId)
    })
  })
})
