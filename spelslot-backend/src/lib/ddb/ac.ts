import type { DdbRawCharacter, DdbRawModifier } from './types'
import { filterMods, modSum } from './modifiers'
import type { Abilities } from './abilities'
import { STAT_TO_KEY } from './abilities'

function modVal(m: DdbRawModifier): number {
  return (m.fixedValue ?? m.value) ?? 0
}

export function parseAC(ddb: DdbRawCharacter, allMods: DdbRawModifier[], abils: Abilities): number {
  // typeId=1 in characterValues is a manual AC override set in the DDB sheet
  const overrideCV = ddb.characterValues.find((cv) => cv.typeId === 1)
  if (overrideCV?.value != null) return overrideCV.value

  const dex = abils.dex.modifier

  const equippedArmor = ddb.inventory.filter((i) => i.equipped && i.definition.filterType === 'Armor')
  const shields = equippedArmor.filter((i) => i.definition.armorTypeId === 4)
  const bodyArmors = equippedArmor.filter((i) => i.definition.armorTypeId !== 4)

  // Shield AC (a character could have multiple shields equipped in DDB — take them all)
  const shieldAC = shields.reduce((sum, s) => sum + (s.definition.armorClass ?? 2), 0)

  // Global AC bonus from character.modifiers.* — DDB pre-filters this array for
  // equipped + attunement requirements, so it already covers rings, cloaks, magic armor
  // magical bonuses (+1 armor encodes its base as armorClass, bonus in modifiers.item[]).
  const globalBonus = modSum(filterMods(allMods, 'bonus', 'armor-class', [null, '']))

  let baseAC: number

  if (bodyArmors.length > 0) {
    // Medium armor max-DEX can be raised by Mithral armor or the Medium Armor Master feat
    const maxDex = Math.max(
      ...filterMods(allMods, 'set', 'ac-max-dex-armored-modifier', [null, '']).map(
        (m) => (m.fixedValue ?? m.value) ?? 2,
      ),
      2,
    )

    // item.definition.armorClass is the BASE AC before magical enhancement.
    // The magical bonus (e.g. +1 Studded Leather's +1) appears in character.modifiers.item[]
    // and is already included in globalBonus above.
    const options = bodyArmors.map((armor) => {
      const base = armor.definition.armorClass ?? 0
      const typeId = armor.definition.armorTypeId
      if (typeId === 1) return base + dex // light: full DEX
      if (typeId === 2) return base + Math.min(dex, maxDex) // medium: DEX capped
      return base // heavy: no DEX
    })
    baseAC = Math.max(0, ...options)

    // Armored AC bonus — e.g. Fighter's Defense fighting style (+1 while wearing armor)
    const armoredBonus = modSum(
      filterMods(allMods, 'bonus', 'armored-armor-class').filter((m) => m.isGranted),
    )
    baseAC += armoredBonus
  } else {
    // Unarmored — class/race/feat features define alternative base AC formulas via
    // type=set subType=unarmored-armor-class modifiers:
    //   statId=3 (CON), value=0  → Barbarian Unarmored Defense: 10 + DEX + CON
    //   statId=5 (WIS), value=0  → Monk Unarmored Defense:      10 + DEX + WIS
    //   statId=null,   value=3   → Draconic Resilience / Dragon Hide: 10 + DEX + 3 = 13 + DEX
    //   statId=null,   value=N   → other class features with a fixed bonus
    const unarmoredSets = filterMods(allMods, 'set', 'unarmored-armor-class').filter(
      (m) => m.isGranted,
    )

    const options = [10 + dex] // baseline unarmored (no feature) is always an option
    for (const mod of unarmoredSets) {
      let ac = 10 + dex
      if (mod.statId != null) {
        const key = STAT_TO_KEY[mod.statId]
        if (key) ac += abils[key].modifier
      }
      ac += modVal(mod)
      options.push(ac)
    }
    baseAC = Math.max(...options)

    // Extra bonus while unarmored (uncommon; distinct from the set-formula above)
    baseAC += modSum(filterMods(allMods, 'bonus', 'unarmored-armor-class'))
  }

  return baseAC + shieldAC + globalBonus
}
