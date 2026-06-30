import type { DdbRawCharacter, DdbRawModifier } from './types'
import { filterMods, modSum, findClassByFeatureId } from './modifiers'

export function parseMaxHp(
  ddb: DdbRawCharacter,
  allMods: DdbRawModifier[],
  conModifier: number,
  totalLevel: number,
): number {
  if (ddb.overrideHitPoints != null) return ddb.overrideHitPoints

  const base = ddb.baseHitPoints // HD total without CON — DDB computes this server-side
  const bonusHp = ddb.bonusHitPoints ?? 0

  // Per-level HP bonuses. These can be attributed to a specific class level
  // (e.g. Draconic Resilience: +1/sorcerer level) or total level (e.g. Tough feat: +2/level).
  let perLevelBonus = 0
  for (const m of filterMods(allMods, 'bonus', 'hit-points-per-level')) {
    const cls = findClassByFeatureId(ddb, m.componentId)
    const levels = cls ? cls.level : totalLevel
    perLevelBonus += levels * ((m.fixedValue ?? m.value) ?? 0)
  }

  // Fixed HP bonuses (rare — e.g. certain magic items)
  const fixedBonus = modSum(filterMods(allMods, 'bonus', 'hit-points'))

  // DDB's baseHitPoints does not include CON; we add CON mod × total level here.
  return base + bonusHp + conModifier * totalLevel + perLevelBonus + fixedBonus
}
