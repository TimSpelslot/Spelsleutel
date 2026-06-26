import { api } from './api'
import type { Result } from '@/types'

export interface MonsterSummary {
  slug: string
  name: string
  challenge_rating: string
  type: string
  size: string
}

export interface MonsterAction {
  name: string
  desc: string
  attack_bonus?: number
  damage_dice?: string
  damage_bonus?: number
}

export interface Monster {
  slug: string
  name: string
  size: string
  type: string
  subtype: string
  group?: string
  alignment: string
  armor_class: number
  armor_desc: string
  hit_points: number
  hit_dice: string
  speed: Record<string, number>
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
  strength_save: number | null
  dexterity_save: number | null
  constitution_save: number | null
  intelligence_save: number | null
  wisdom_save: number | null
  charisma_save: number | null
  perception: number | null
  skills: Record<string, number>
  damage_vulnerabilities: string
  damage_resistances: string
  damage_immunities: string
  condition_immunities: string
  senses: string
  languages: string
  challenge_rating: string
  cr: number
  actions: MonsterAction[]
  bonus_actions?: MonsterAction[]
  reactions: MonsterAction[]
  legendary_desc?: string
  legendary_actions: MonsterAction[]
  special_abilities: MonsterAction[]
  document__title: string
}

export const monsterService = {
  async search(name: string): Promise<Result<MonsterSummary[]>> {
    const result = await api.get<{ results: MonsterSummary[] }>(
      `/api/monsters?search=${encodeURIComponent(name)}`,
    )
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.results }
  },

  async get(slug: string): Promise<Result<Monster>> {
    return api.get<Monster>(`/api/monsters/${slug}`)
  },

  async fromUrl(
    url: string,
  ): Promise<Result<{ monster: Monster; alternatives: MonsterSummary[]; extractedName?: string }>> {
    return api.post('/api/monsters/from-url', { url })
  },
}
