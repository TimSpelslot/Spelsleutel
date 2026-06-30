import { Schema, model } from 'mongoose'

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
  modifier: number    // ability modifier (before proficiency)
  proficient: boolean
  total: number       // final value: modifier + proficiency bonus (if any) + bonuses
}

export interface DdbCharacterData {
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

export interface IDdbCharacterCache {
  characterId: string
  data: DdbCharacterData
  fetchedAt: Date
}

const DdbCharacterCacheSchema = new Schema<IDdbCharacterCache>({
  characterId: { type: String, required: true, unique: true, index: true },
  data: { type: Schema.Types.Mixed, required: true },
  fetchedAt: { type: Date, required: true },
})

export const DdbCharacterCache = model<IDdbCharacterCache>(
  'DdbCharacterCache',
  DdbCharacterCacheSchema,
)
