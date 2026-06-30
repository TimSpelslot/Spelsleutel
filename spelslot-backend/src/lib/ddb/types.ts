// Raw DDB character JSON shape (from character-service.dndbeyond.com/character/v5/character/:id)
// Fields are typed as they appear in the actual API response.

export interface DdbRawStat {
  id: number // 1=STR 2=DEX 3=CON 4=INT 5=WIS 6=CHA
  value: number | null
}

export interface DdbRawModifier {
  id: string
  type: string // "bonus" | "proficiency" | "set" | "half-proficiency" | "expertise" | "ignore"
  subType: string // e.g. "strength-score", "armor-class", "hit-points-per-level"
  statId: number | null // 1–6 ability reference (for unarmored-armor-class etc.)
  entityId: number | null
  entityTypeId: number | null
  componentId: number // links modifier to a class feature / feat / item
  componentTypeId: number
  fixedValue: number | null
  value: number | null
  restriction: string | null
  requiresAttunement: boolean
  isGranted: boolean
  friendlySubtypeName: string
  friendlyTypeName: string
}

export interface DdbRawClassFeature {
  id: number
  definition: {
    id: number
    name: string
    requiredLevel?: number
  }
}

export interface DdbRawClass {
  id: number
  level: number
  definition: { id: number; name: string; hitDice: number }
  subclassDefinition?: { id: number; name: string; classFeatures: DdbRawClassFeature[] }
  classFeatures: DdbRawClassFeature[]
}

export interface DdbRawInventoryItem {
  id: number
  equipped: boolean
  isAttuned: boolean
  canAttune: boolean
  quantity: number
  definition: {
    id: number
    name: string
    filterType: string // "Armor", "Weapon", "Ring", "Wondrous item", etc.
    armorTypeId: number | null // 1=Light 2=Medium 3=Heavy 4=Shield
    armorClass: number | null
    magic: boolean
    grantedModifiers: DdbRawModifier[]
    canAttune?: boolean
    requiresAttunement?: boolean
  }
}

export interface DdbRawCharacterValue {
  typeId: number
  valueId: string | number
  value: number | null
}

export interface DdbRawCharacter {
  id: number
  name: string
  avatarUrl: string | null

  // Ability scores
  stats: DdbRawStat[]
  bonusStats: DdbRawStat[]
  overrideStats: DdbRawStat[]

  // Hit points
  baseHitPoints: number
  bonusHitPoints: number | null
  overrideHitPoints: number | null
  removedHitPoints: number
  temporaryHitPoints: number

  preferences: {
    hitPointType: number // 1=average 2=rolled
  }

  // Classes
  classes: DdbRawClass[]

  // Race
  race: {
    fullName: string
    weightSpeeds?: {
      normal?: { walk: number; fly?: number; swim?: number; climb?: number }
      override?: { walk?: number; fly?: number; swim?: number; climb?: number }
    }
  } | null

  // Inventory
  inventory: DdbRawInventoryItem[]

  // All modifiers grouped by source
  modifiers: {
    class: DdbRawModifier[]
    race: DdbRawModifier[]
    background: DdbRawModifier[]
    feat: DdbRawModifier[]
    item: DdbRawModifier[]
    [key: string]: DdbRawModifier[]
  }

  // Manual overrides set by the user in DDB
  characterValues: DdbRawCharacterValue[]

  // Background (for 2024 rules feat handling)
  background?: {
    definition?: {
      grantedFeats?: Array<{ featIds: number[]; name: string }>
    }
  }

  customProficiencies?: unknown[]
}
