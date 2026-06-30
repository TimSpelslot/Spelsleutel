import { api } from './api'
import type { Result } from '@/types'

export interface DdbClass {
  name: string
  subclass?: string
  level: number
}

export interface DdbStats {
  str: number
  dex: number
  con: number
  int: number
  wis: number
  cha: number
}

export interface DdbSavingThrow {
  modifier: number
  proficient: boolean
  total: number
}

export interface DdbCharacter {
  id: number
  name: string
  avatarUrl: string | null
  totalLevel: number
  classes: DdbClass[]
  maxHp: number
  stats: DdbStats
  modifiers: DdbStats
  proficiencyBonus: number
  savingThrowProficiencies: Array<keyof DdbStats>  // backward compat
  savingThrows: Record<keyof DdbStats, DdbSavingThrow>
  armorClass: number
  speed: number
}

export interface DdbResponse {
  character: DdbCharacter
  cachedAt?: string
  stale?: boolean
}

export const ddbService = {
  async getCharacter(characterId: string): Promise<Result<DdbResponse>> {
    const r = await api.get<DdbResponse>(`/api/ddb/character/${characterId}`)
    if (r.type === 'error') return r
    return { type: 'ok', data: r.data }
  },

  async refreshCharacter(characterId: string): Promise<Result<DdbResponse>> {
    // Clear cache first, then re-fetch
    await api.delete(`/api/ddb/character/${characterId}/cache`)
    return this.getCharacter(characterId)
  },
}
