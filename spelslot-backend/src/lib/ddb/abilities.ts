import type { DdbRawCharacter, DdbRawModifier } from './types'
import { filterMods, modSum } from './modifiers'

export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

export interface AbilityScore {
  score: number
  modifier: number
}

export type Abilities = Record<AbilityKey, AbilityScore>

export const ABILITY_KEYS: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

export const STAT_TO_KEY: Record<number, AbilityKey> = {
  1: 'str',
  2: 'dex',
  3: 'con',
  4: 'int',
  5: 'wis',
  6: 'cha',
}

const ABILITY_SUBTYPE: Record<AbilityKey, string> = {
  str: 'strength-score',
  dex: 'dexterity-score',
  con: 'constitution-score',
  int: 'intelligence-score',
  wis: 'wisdom-score',
  cha: 'charisma-score',
}

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

// Restriction strings that indicate a straightforward bonus (not a score-cap raiser)
const BONUS_RESTRICTIONS: (string | null)[] = [
  null,
  '',
  '+2 to score maximum',
  '+4 to score maximum',
  '+2 to maximum score',
  '+4 to maximum score',
  "Can't be an Ability Score you already increased with this trait.",
  'That you do not have Saving Throw Proficiency in.',
]

const CAP_RE = /(?:Your maximum is now |Maximum of |maximum of )(\d+)/

export function parseAbilities(ddb: DdbRawCharacter, allMods: DdbRawModifier[]): Abilities {
  const result = {} as Abilities

  for (let i = 0; i < 6; i++) {
    const key = ABILITY_KEYS[i]
    const statId = i + 1
    const subType = ABILITY_SUBTYPE[key]

    const base = ddb.stats.find((s) => s.id === statId)?.value ?? 10
    const bonusStat = ddb.bonusStats.find((s) => s.id === statId)?.value ?? 0
    const overrideStat = ddb.overrideStats.find((s) => s.id === statId)?.value ?? 0

    // Hard override wins immediately (set via DDB character values)
    if (overrideStat !== 0) {
      result[key] = { score: overrideStat, modifier: abilityModifier(overrideStat) }
      continue
    }

    // Set modifiers: tomes, magic items that set a score to a minimum
    const setMods = filterMods(allMods, 'set', subType, [null, '', 'if not already higher'])
    const setScore =
      setMods.length > 0 ? Math.max(...setMods.map((m) => (m.fixedValue ?? m.value) ?? 0)) : 0

    // Normal bonus modifiers (feats, racial ASI, items) — unrestricted or common restrictions
    const bonus = modSum(filterMods(allMods, 'bonus', subType, BONUS_RESTRICTIONS))

    // Cap-raising modifiers (e.g. "Your maximum is now 22" from some rare feats)
    const cappedMods = allMods.filter(
      (m) =>
        m.type === 'bonus' &&
        m.subType === subType &&
        m.restriction != null &&
        CAP_RE.test(m.restriction),
    )
    let cap = 20
    let cappedBonus = 0
    for (const m of cappedMods) {
      const match = CAP_RE.exec(m.restriction!)
      if (match) cap = Math.max(cap, parseInt(match[1]))
      cappedBonus += (m.fixedValue ?? m.value) ?? 0
    }

    // 5-layer resolution: base → bonus → cap → bonusStat (racial max override) → set minimum
    const calculated = base + bonus + cappedBonus
    const capped = Math.min(cap, calculated) + bonusStat
    const score = Math.max(capped, setScore)
    result[key] = { score, modifier: abilityModifier(score) }
  }

  return result
}
