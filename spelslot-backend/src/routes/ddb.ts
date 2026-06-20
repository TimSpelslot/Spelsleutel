import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { DdbCharacterCache, type DdbCharacterData, type DdbStats, type DdbClass } from '../models/DdbCharacterCache'

export const ddbRouter = Router()

ddbRouter.use(requireAuth)

const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes
const DDB_API = 'https://character-service.dndbeyond.com/character/v5/character'

function ddbHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'User-Agent': 'Mozilla/5.0 (compatible; Spelslot/1.0)' }
  const cobalt = process.env.DDB_COBALT_TOKEN
  if (cobalt) headers['Cookie'] = `.COBALT_TOKEN=${cobalt}`
  return headers
}

// Stat IDs in DnD Beyond order: 1=STR 2=DEX 3=CON 4=INT 5=WIS 6=CHA
const STAT_KEYS: (keyof DdbStats)[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

function modifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

function proficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1
}

function parseCharacter(raw: Record<string, unknown>): DdbCharacterData {
  const d = raw as Record<string, unknown>

  // Classes
  const rawClasses = (d.classes as unknown[]) ?? []
  const classes: DdbClass[] = rawClasses.map((c) => {
    const cls = c as Record<string, unknown>
    const def = cls.definition as Record<string, unknown>
    const sub = cls.subclassDefinition as Record<string, unknown> | undefined
    return {
      name: (def?.name as string) ?? 'Unknown',
      subclass: (sub?.name as string) ?? undefined,
      level: (cls.level as number) ?? 1,
    }
  })
  const totalLevel = classes.reduce((sum, c) => sum + c.level, 0) || 1

  // HP
  const base = (d.baseHitPoints as number) ?? 0
  const bonus = (d.bonusHitPoints as number) ?? 0
  const override = d.overrideHitPoints as number | null
  const maxHp = override != null ? override : base + bonus

  // Ability scores: base stats + bonus stats + override stats
  const rawStats = (d.stats as { id: number; value: number | null }[]) ?? []
  const rawBonus = (d.bonusStats as { id: number; value: number | null }[]) ?? []
  const rawOverride = (d.overrideStats as { id: number; value: number | null }[]) ?? []

  const scores = {} as DdbStats
  for (let i = 0; i < 6; i++) {
    const key = STAT_KEYS[i]
    const id = i + 1
    const over = rawOverride.find((s) => s.id === id)?.value
    if (over != null) {
      scores[key] = over
    } else {
      const base2 = rawStats.find((s) => s.id === id)?.value ?? 10
      const bon = rawBonus.find((s) => s.id === id)?.value ?? 0
      scores[key] = base2 + bon
    }
  }

  const mods = {} as DdbStats
  for (const key of STAT_KEYS) {
    mods[key] = modifier(scores[key])
  }

  // All modifiers flat across all sources (class, race, feat, item, background…)
  const modGroups = d.modifiers as Record<string, Array<Record<string, unknown>>> | undefined
  const allMods = Object.values(modGroups ?? {}).flat()

  // Saving throw proficiencies — look for type="proficiency", subType="*-saving-throws"
  const SAVE_MAP: Record<string, keyof DdbStats> = {
    'strength-saving-throws': 'str',
    'dexterity-saving-throws': 'dex',
    'constitution-saving-throws': 'con',
    'intelligence-saving-throws': 'int',
    'wisdom-saving-throws': 'wis',
    'charisma-saving-throws': 'cha',
  }
  const saveProfs = new Set<keyof DdbStats>()
  for (const m of allMods) {
    if (m.type === 'proficiency' && typeof m.subType === 'string' && SAVE_MAP[m.subType]) {
      saveProfs.add(SAVE_MAP[m.subType])
    }
  }

  // Speed — base from race weightSpeeds, plus any bonus modifiers
  const race = d.race as Record<string, unknown> | undefined
  const weightSpeeds = race?.weightSpeeds as Record<string, Record<string, number> | null> | undefined
  const overrideWalk = weightSpeeds?.override?.walk
  let speed = overrideWalk ?? weightSpeeds?.normal?.walk ?? 30
  for (const m of allMods) {
    if (m.type === 'bonus' && m.subType === 'speed' && typeof m.fixedValue === 'number') {
      speed += m.fixedValue
    }
  }

  // AC — find equipped armor and shield in inventory
  type InvItem = { equipped: boolean; definition: Record<string, unknown> }
  const inventory = (d.inventory as InvItem[]) ?? []
  const ARMOR_TYPE: Record<number, 'light' | 'medium' | 'heavy' | 'shield'> = {
    1: 'light', 2: 'medium', 3: 'heavy', 4: 'shield',
  }
  const equippedArmor = inventory.filter(i => i.equipped && i.definition?.filterType === 'Armor')
  const armor = equippedArmor.find(i => {
    const t = ARMOR_TYPE[i.definition.armorTypeId as number]
    return t === 'light' || t === 'medium' || t === 'heavy'
  })
  const hasShield = equippedArmor.some(i => ARMOR_TYPE[i.definition.armorTypeId as number] === 'shield')
  const shieldBonus = hasShield ? 2 : 0

  let armorClass: number
  if (armor) {
    const baseAc = (armor.definition.armorClass as number) ?? 10
    const kind = ARMOR_TYPE[armor.definition.armorTypeId as number]
    if (kind === 'light') armorClass = baseAc + mods.dex + shieldBonus
    else if (kind === 'medium') armorClass = baseAc + Math.min(mods.dex, 2) + shieldBonus
    else armorClass = baseAc + shieldBonus // heavy
  } else {
    // Unarmored — 10 + DEX, plus any unarmored-armor-class bonus mods (Barbarian, Monk)
    armorClass = 10 + mods.dex
    for (const m of allMods) {
      if (m.subType === 'unarmored-armor-class') {
        if (typeof m.fixedValue === 'number') armorClass += m.fixedValue
        // statId 1–6 maps to STR–CHA mod (Barbarian = CON = 3, Monk = WIS = 5)
        if (typeof m.statId === 'number' && m.statId >= 1 && m.statId <= 6) {
          armorClass += mods[STAT_KEYS[m.statId - 1]]
        }
      }
    }
    armorClass += shieldBonus
  }

  return {
    id: d.id as number,
    name: (d.name as string) ?? 'Unknown',
    avatarUrl: (d.avatarUrl as string | null) ?? null,
    totalLevel,
    classes,
    maxHp,
    stats: scores,
    modifiers: mods,
    proficiencyBonus: proficiencyBonus(totalLevel),
    savingThrowProficiencies: Array.from(saveProfs),
    armorClass,
    speed,
  }
}

function extractCharacterId(raw: string): string | null {
  // Accept plain numeric ID or a full DnD Beyond character URL
  const urlMatch = raw.match(/dndbeyond\.com\/characters\/(\d+)/i)
  if (urlMatch) return urlMatch[1]
  if (/^\d+$/.test(raw)) return raw
  return null
}

// GET /api/ddb/character/:characterId
ddbRouter.get('/character/:characterId', async (req, res, next) => {
  try {
    const raw = decodeURIComponent(req.params.characterId)
    const characterId = extractCharacterId(raw)

    if (!characterId) {
      res.status(400).json({ message: 'Character ID must be a number or a DnD Beyond character URL' })
      return
    }

    // Return cached data if fresh
    const cached = await DdbCharacterCache.findOne({ characterId }).lean()
    if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
      res.json({ character: cached.data, cachedAt: cached.fetchedAt })
      return
    }

    // Fetch from DnD Beyond (server-side — no CORS issue)
    let fetchRes: Response
    try {
      fetchRes = await fetch(`${DDB_API}/${characterId}`, {
        headers: ddbHeaders(),
        signal: AbortSignal.timeout(8000),
      })
    } catch (err) {
      // Network error — return stale cache if available
      if (cached) {
        res.json({ character: cached.data, cachedAt: cached.fetchedAt, stale: true })
        return
      }
      throw err
    }

    const hasCobalt = !!process.env.DDB_COBALT_TOKEN

    if (fetchRes.status === 404) {
      console.warn(`[ddb] 404 for character ${characterId} — hasCobalt=${hasCobalt}`)
      const hint = hasCobalt
        ? `Character ${characterId} not found or is not accessible with the configured cobalt token.`
        : `Character ${characterId} not found. DnD Beyond's API requires a cobalt token (DDB_COBALT_TOKEN) even for public characters — ask an admin to configure it.`
      res.status(404).json({ message: hint })
      return
    }

    if (fetchRes.status === 401 || fetchRes.status === 403) {
      if (cached) {
        res.json({ character: cached.data, cachedAt: cached.fetchedAt, stale: true })
        return
      }
      const hint = hasCobalt
        ? 'DnD Beyond authentication failed — the cobalt token may have expired. Ask an admin to refresh DDB_COBALT_TOKEN.'
        : 'Character is private. Ask an admin to configure DDB_COBALT_TOKEN for campaign access.'
      res.status(502).json({ message: hint })
      return
    }

    if (!fetchRes.ok) {
      if (cached) {
        res.json({ character: cached.data, cachedAt: cached.fetchedAt, stale: true })
        return
      }
      res.status(502).json({ message: `DnD Beyond returned ${fetchRes.status}. The service may be temporarily unavailable.` })
      return
    }

    const json = (await fetchRes.json()) as { data?: Record<string, unknown> }
    if (!json.data) {
      const hint = hasCobalt
        ? 'Character not found, or this character is not in any of your campaigns on DnD Beyond.'
        : 'Character not found or is set to Private on DnD Beyond.'
      res.status(404).json({ message: hint })
      return
    }

    const character = parseCharacter(json.data)

    await DdbCharacterCache.findOneAndUpdate(
      { characterId },
      { $set: { data: character, fetchedAt: new Date() } },
      { upsert: true },
    )

    res.json({ character })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/ddb/character/:characterId/cache — force refresh
ddbRouter.delete('/character/:characterId/cache', async (req, res, next) => {
  try {
    await DdbCharacterCache.deleteOne({ characterId: req.params.characterId })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
