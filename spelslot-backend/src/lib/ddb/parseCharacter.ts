import type { DdbRawCharacter } from './types'
import { getAllMods } from './modifiers'
import { parseAbilities, ABILITY_KEYS } from './abilities'
import { parseMaxHp } from './hp'
import { parseAC } from './ac'
import { parseSavingThrows } from './savingThrows'
import type { SavingThrows } from './savingThrows'
import type { AbilityKey } from './abilities'

export interface ParsedClass {
  name: string
  subclass?: string
  level: number
}

export interface ParsedStats {
  str: number
  dex: number
  con: number
  int: number
  wis: number
  cha: number
}

export interface ParsedCharacter {
  id: number
  name: string
  avatarUrl: string | null
  totalLevel: number
  classes: ParsedClass[]
  maxHp: number
  stats: ParsedStats        // ability scores
  modifiers: ParsedStats    // ability modifiers (backward compat name)
  proficiencyBonus: number
  savingThrowProficiencies: AbilityKey[]  // backward compat
  savingThrows: SavingThrows
  armorClass: number
  speed: number
}

function calcProfBonus(totalLevel: number): number {
  return Math.ceil(totalLevel / 4) + 1
}

function parseSpeed(ddb: DdbRawCharacter, allMods: ReturnType<typeof getAllMods>): number {
  const weights = ddb.race?.weightSpeeds
  let speed = weights?.override?.walk ?? weights?.normal?.walk ?? 30
  for (const m of allMods) {
    if (m.type === 'bonus' && (m.subType === 'speed' || m.subType === 'walking-speed')) {
      speed += (m.fixedValue ?? m.value) ?? 0
    }
  }
  return speed
}

export function parseCharacter(raw: Record<string, unknown>): ParsedCharacter {
  const ddb = raw as unknown as DdbRawCharacter

  const classes: ParsedClass[] = ddb.classes.map((c) => ({
    name: c.definition?.name ?? 'Unknown',
    subclass: c.subclassDefinition?.name,
    level: c.level,
  }))
  const totalLevel = classes.reduce((sum, c) => sum + c.level, 0) || 1
  const profBonus = calcProfBonus(totalLevel)

  const allMods = getAllMods(ddb)
  const abils = parseAbilities(ddb, allMods)

  const stats = {} as ParsedStats
  const modifiers = {} as ParsedStats
  for (const key of ABILITY_KEYS) {
    stats[key] = abils[key].score
    modifiers[key] = abils[key].modifier
  }

  const maxHp = parseMaxHp(ddb, allMods, abils.con.modifier, totalLevel)
  const armorClass = parseAC(ddb, allMods, abils)
  const savingThrows = parseSavingThrows(ddb, allMods, abils, profBonus)

  const savingThrowProficiencies = (Object.keys(savingThrows) as AbilityKey[]).filter(
    (k) => savingThrows[k].proficient,
  )

  const speed = parseSpeed(ddb, allMods)

  return {
    id: ddb.id,
    name: ddb.name ?? 'Unknown',
    avatarUrl: ddb.avatarUrl ?? null,
    totalLevel,
    classes,
    maxHp,
    stats,
    modifiers,
    proficiencyBonus: profBonus,
    savingThrowProficiencies,
    savingThrows,
    armorClass,
    speed,
  }
}
