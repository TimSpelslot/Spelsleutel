import type { DdbRawCharacter, DdbRawModifier } from './types'

export function getAllMods(ddb: DdbRawCharacter): DdbRawModifier[] {
  return Object.values(ddb.modifiers).flat()
}

export function filterMods(
  mods: DdbRawModifier[],
  type: string,
  subType?: string,
  restriction?: (string | null)[],
): DdbRawModifier[] {
  return mods.filter(
    (m) =>
      m.type === type &&
      (subType == null || m.subType === subType) &&
      (restriction == null || restriction.includes(m.restriction)),
  )
}

export function modSum(mods: DdbRawModifier[]): number {
  return mods.reduce((sum, m) => sum + ((m.fixedValue ?? m.value) ?? 0), 0)
}

// Walk class features (base + subclass) to find which class owns a given componentId.
// Used to attribute per-level HP bonuses to the correct class level in multiclass scenarios.
export function findClassByFeatureId(ddb: DdbRawCharacter, componentId: number) {
  return ddb.classes.find(
    (cls) =>
      cls.classFeatures.some((f) => f.definition.id === componentId) ||
      (cls.subclassDefinition?.classFeatures ?? []).some((f) => f.definition.id === componentId),
  )
}
