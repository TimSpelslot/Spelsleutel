import type { DdbRawCharacter, DdbRawModifier } from './types'
import { filterMods, modSum } from './modifiers'
import type { Abilities, AbilityKey } from './abilities'
import { ABILITY_KEYS } from './abilities'

const SAVE_SUBTYPE: Record<AbilityKey, string> = {
  str: 'strength-saving-throws',
  dex: 'dexterity-saving-throws',
  con: 'constitution-saving-throws',
  int: 'intelligence-saving-throws',
  wis: 'wisdom-saving-throws',
  cha: 'charisma-saving-throws',
}

export interface SavingThrow {
  modifier: number  // ability modifier (before prof)
  proficient: boolean
  total: number     // ability modifier + proficiency (if any) + bonuses
}

export type SavingThrows = Record<AbilityKey, SavingThrow>

export function parseSavingThrows(
  ddb: DdbRawCharacter,
  allMods: DdbRawModifier[],
  abils: Abilities,
  profBonus: number,
): SavingThrows {
  const result = {} as SavingThrows

  for (let i = 0; i < 6; i++) {
    const key = ABILITY_KEYS[i]
    const statId = i + 1
    const subType = SAVE_SUBTYPE[key]
    const abilMod = abils[key].modifier

    // Proficiency from class/background/feat modifiers
    const hasProfMod = filterMods(allMods, 'proficiency', subType).length > 0

    // Manual proficiency override from characterValues (typeId=25, valueId=statId, value>0)
    const customProfCV = ddb.characterValues.find(
      (cv) => cv.typeId === 25 && Number(cv.valueId) === statId,
    )
    const isProficient = customProfCV != null ? (customProfCV.value ?? 0) > 0 : hasProfMod

    // Half-proficiency (some features grant this to saves the character isn't proficient in)
    const hasHalfProf =
      !isProficient && filterMods(allMods, 'half-proficiency', subType).length > 0

    // Flat bonus to this saving throw (Cloak of Protection, Paladin aura, etc.)
    const saveBonus = modSum(filterMods(allMods, 'bonus', subType, [null, '']))

    // Custom bonus from characterValues (typeId=39 = flat modifier)
    const customBonus = ddb.characterValues
      .filter((cv) => cv.typeId === 39 && Number(cv.valueId) === statId)
      .reduce((sum, cv) => sum + (cv.value ?? 0), 0)

    const profValue = isProficient ? profBonus : hasHalfProf ? Math.floor(profBonus / 2) : 0
    const total = abilMod + profValue + saveBonus + customBonus

    result[key] = { modifier: abilMod, proficient: isProficient, total }
  }

  return result
}
