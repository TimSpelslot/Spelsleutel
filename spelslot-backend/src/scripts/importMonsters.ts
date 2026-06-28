import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '../config/db'
import { Monster } from '../models/Monster'
import type { IMonster, IMonsterAction } from '../models/Monster'
import { toSlug } from '../utils/slug'

function crToNumeric(cr: string | undefined): number {
  if (!cr) return 0
  const fractions: Record<string, number> = { '0': 0, '1/8': 0.125, '1/4': 0.25, '1/2': 0.5 }
  return fractions[cr] !== undefined ? fractions[cr] : parseFloat(cr) || 0
}

// ── 5etools tag stripper ──────────────────────────────────────────────────

function stripTags(text: string): string {
  // {@h} has no content — means "Hit: "
  let result = text.replace(/\{@h\}/g, 'Hit: ')

  // Tags with content: {@tag content} or {@tag content|display} or {@tag content||alt}
  result = result.replace(/\{@(\w+)\s+([^}]+)\}/g, (_match, tag: string, raw: string) => {
    // Split on || for alternate display, then | for piped segments
    const altParts = raw.split('||')
    const display = (altParts[altParts.length - 1] ?? '').split('|')[0].trim()
    const primary = (altParts[0] ?? '').split('|')[0].trim()

    switch (tag) {
      case 'hit':
        return `+${primary}`
      case 'damage':
      case 'dice':
      case 'd20':
      case 'scaledice':
      case 'scaledamage':
        return primary
      case 'dc':
        return `DC ${primary}`
      case 'atk': {
        const types = primary.split(',').map((t: string) => t.trim())
        const labels = types.map((t: string) => {
          if (t === 'mw') return 'Melee Weapon Attack:'
          if (t === 'rw') return 'Ranged Weapon Attack:'
          if (t === 'ms') return 'Melee Spell Attack:'
          if (t === 'rs') return 'Ranged Spell Attack:'
          return t.toUpperCase()
        })
        return labels.join(' or ')
      }
      case 'recharge':
        return primary ? `(Recharge ${primary}–6)` : '(Recharge 6)'
      case 'chance':
        return `${primary}%`
      case 'ability': {
        const abilityMap: Record<string, string> = {
          str: 'Strength',
          dex: 'Dexterity',
          con: 'Constitution',
          int: 'Intelligence',
          wis: 'Wisdom',
          cha: 'Charisma',
        }
        return abilityMap[primary.toLowerCase()] ?? primary
      }
      default:
        return display || primary
    }
  })

  // Remaining {@tag} with no content
  result = result.replace(/\{@\w+\}/g, '')
  return result
}

function extractEntries(entries: unknown): string {
  if (!Array.isArray(entries)) return ''
  return entries
    .map((e) => {
      if (typeof e === 'string') return stripTags(e)
      if (typeof e === 'object' && e !== null) {
        const obj = e as Record<string, unknown>
        if (obj.type === 'list' && Array.isArray(obj.items)) {
          return extractEntries(obj.items)
        }
        const sub = extractEntries(obj.entries)
        if (obj.name) return `${stripTags(String(obj.name))}: ${sub}`
        return sub
      }
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function toActions(arr: unknown): IMonsterAction[] {
  if (!Array.isArray(arr)) return []
  return arr
    .map((a: unknown) => {
      if (typeof a !== 'object' || a === null) return null
      const ae = a as Record<string, unknown>
      return {
        name: stripTags(String(ae.name ?? '')),
        desc: extractEntries(ae.entries),
      }
    })
    .filter((x): x is IMonsterAction => x !== null)
}

// ── 5etools source → book title ───────────────────────────────────────────

const SOURCE_TITLES: Record<string, string> = {
  MM: 'Monster Manual',
  XMM: 'Monster Manual (2024)',
  VGM: "Volo's Guide to Monsters",
  MTF: "Mordenkainen's Tome of Foes",
  MPMM: 'Mordenkainen Presents: Monsters of the Multiverse',
  BGDIA: "Baldur's Gate: Descent into Avernus",
  IDROTF: 'Icewind Dale: Rime of the Frostmaiden',
  TCE: "Tasha's Cauldron of Everything",
  COS: 'Curse of Strahd',
  TOA: 'Tomb of Annihilation',
  PHB: "Player's Handbook",
  DMG: "Dungeon Master's Guide",
  GGR: "Guildmasters' Guide to Ravnica",
  MOT: 'Mythic Odysseys of Theros',
  EGW: "Explorer's Guide to Wildemount",
  ERLW: 'Eberron: Rising from the Last War',
  WDH: 'Waterdeep: Dragon Heist',
  WDMM: 'Waterdeep: Dungeon of the Mad Mage',
  POTA: 'Princes of the Apocalypse',
  OOTA: 'Out of the Abyss',
  HOTDQ: 'Hoard of the Dragon Queen',
  ROT: 'Rise of Tiamat',
  SKT: "Storm King's Thunder",
  TFTYP: 'Tales from the Yawning Portal',
  AI: 'Acquisitions Incorporated',
  GOS: 'Ghosts of Saltmarsh',
  CM: 'Candlekeep Mysteries',
  WBTW: 'The Wild Beyond the Witchlight',
  CRCOTN: 'Critical Role: Call of the Netherdeep',
  LOX: 'Light of Xaryxis',
  QFTIS: 'Quests from the Infinite Staircase',
  FTD: "Fizban's Treasury of Dragons",
  VRGR: 'Van Richten\'s Guide to Ravenloft',
  SCC: 'Strixhaven: A Curriculum of Chaos',
  DSoTDQ: 'Dragonlance: Shadow of the Dragon Queen',
  BAM: 'Spelljammer: Adventures in Space',
  PABTSO: 'Phandelver and Below: The Shattered Obelisk',
  BMT: 'The Book of Many Things',
  XGE: "Xanathar's Guide to Everything",
  XDMG: "Dungeon Master's Guide (2024)",
  XPHB: "Player's Handbook (2024)",
  BGG: 'Bigby Presents: Glory of the Giants',
  VEOR: 'Vecna: Eve of Ruin',
  MPP: "Morte's Planar Parade",
}

function getSourceTitle(source: string): string {
  return SOURCE_TITLES[source.toUpperCase()] ?? `D&D 5e (${source})`
}

// ── 5etools normalizer ─────────────────────────────────────────────────────

const SIZE_MAP: Record<string, string> = {
  T: 'Tiny',
  S: 'Small',
  M: 'Medium',
  L: 'Large',
  H: 'Huge',
  G: 'Gargantuan',
}

const ALIGN_MAP: Record<string, string> = {
  L: 'lawful',
  C: 'chaotic',
  NX: 'neutral',
  N: 'neutral',
  NY: 'neutral',
  G: 'good',
  E: 'evil',
  U: 'unaligned',
  A: 'any',
}

function parseAlignment(alignment: unknown): string {
  if (typeof alignment === 'string') return alignment
  if (!Array.isArray(alignment) || alignment.length === 0) return 'unaligned'

  const arr: string[] = []
  for (const a of alignment) {
    if (typeof a === 'string') {
      arr.push(a)
    } else if (typeof a === 'object' && a !== null) {
      // {chance, alignment} or {alignment} — pull the sub-alignment
      const sub = (a as Record<string, unknown>).alignment
      if (Array.isArray(sub)) {
        for (const s of sub) if (typeof s === 'string') arr.push(s)
      }
    }
  }

  if (arr.includes('U')) return 'unaligned'
  if (arr.includes('A')) {
    const mods = arr
      .filter((a) => a !== 'A')
      .map((a) => ALIGN_MAP[a] ?? a)
      .filter(Boolean)
    return mods.length ? `any ${mods.join(' ')} alignment` : 'any alignment'
  }

  return [...new Set(arr.map((a) => ALIGN_MAP[a] ?? a))].filter(Boolean).join(' ')
}

function parseAC(ac: unknown): { value: number; desc: string } {
  if (!Array.isArray(ac) || ac.length === 0) return { value: 10, desc: '' }
  const first = ac[0]
  if (typeof first === 'number') return { value: first, desc: '' }
  if (typeof first === 'object' && first !== null) {
    const obj = first as Record<string, unknown>
    const value = typeof obj.ac === 'number' ? obj.ac : 10
    const from = Array.isArray(obj.from) ? `(${obj.from.join(', ')})` : ''
    return { value, desc: from }
  }
  return { value: 10, desc: '' }
}

function parseDamageList(list: unknown): string {
  if (!Array.isArray(list) || list.length === 0) return ''
  const parts: string[] = []
  for (const item of list) {
    if (typeof item === 'string') {
      parts.push(item)
    } else if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>
      const note = obj.note ? ` (${obj.note})` : ''
      if (Array.isArray(obj.immune)) parts.push(obj.immune.map(String).join(', ') + note)
      else if (Array.isArray(obj.resist)) parts.push(obj.resist.map(String).join(', ') + note)
      else if (Array.isArray(obj.vulnerable))
        parts.push(obj.vulnerable.map(String).join(', ') + note)
      else if (obj.special) parts.push(String(obj.special))
    }
  }
  return parts.join('; ')
}

function parseConditionImmune(list: unknown): string {
  if (!Array.isArray(list) || list.length === 0) return ''
  const parts: string[] = []
  for (const item of list) {
    if (typeof item === 'string') {
      parts.push(item)
    } else if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>
      const note = obj.note ? ` (${obj.note})` : ''
      if (Array.isArray(obj.conditionImmune))
        parts.push(obj.conditionImmune.map(String).join(', ') + note)
    }
  }
  return parts.join('; ')
}

function normalize5etools(m: Record<string, unknown>): Partial<IMonster> | null {
  const name = String(m.name ?? '').trim()
  if (!name) return null

  const source = String(m.source ?? '').toUpperCase()
  const slug = toSlug(name)

  // Size
  const sizeArr = Array.isArray(m.size) ? m.size : [m.size]
  const size = SIZE_MAP[String(sizeArr[0] ?? 'M')] ?? 'Medium'

  // Type
  let type = ''
  let subtype = ''
  if (typeof m.type === 'string') {
    type = m.type
  } else if (typeof m.type === 'object' && m.type !== null) {
    const t = m.type as Record<string, unknown>
    type = String(t.type ?? '')
    const tags = Array.isArray(t.tags) ? t.tags.map(String) : []
    subtype = tags.join(', ')
  }
  type = type.charAt(0).toUpperCase() + type.slice(1)

  // AC
  const acData = parseAC(m.ac)

  // HP
  const hpObj = m.hp as Record<string, unknown> | undefined
  const hit_points = typeof hpObj?.average === 'number' ? hpObj.average : 0
  const hit_dice = typeof hpObj?.formula === 'string' ? hpObj.formula : ''

  // Speed — 5etools uses {walk: 30, fly: 60} or {walk: {number: 30, condition: "..."}}
  const speedRaw = (m.speed as Record<string, unknown>) ?? {}
  const speed: Record<string, number> = {}
  for (const [k, v] of Object.entries(speedRaw)) {
    if (k === 'hover') continue
    if (typeof v === 'number') speed[k] = v
    else if (typeof v === 'object' && v !== null) {
      const n = (v as Record<string, unknown>).number
      if (typeof n === 'number') speed[k] = n
    }
  }

  // Ability scores
  const strength = typeof m.str === 'number' ? m.str : 10
  const dexterity = typeof m.dex === 'number' ? m.dex : 10
  const constitution = typeof m.con === 'number' ? m.con : 10
  const intelligence = typeof m.int === 'number' ? m.int : 10
  const wisdom = typeof m.wis === 'number' ? m.wis : 10
  const charisma = typeof m.cha === 'number' ? m.cha : 10

  // Saving throws
  const saveRaw = (m.save as Record<string, string>) ?? {}
  const strength_save = saveRaw.str !== undefined ? parseInt(saveRaw.str) : null
  const dexterity_save = saveRaw.dex !== undefined ? parseInt(saveRaw.dex) : null
  const constitution_save = saveRaw.con !== undefined ? parseInt(saveRaw.con) : null
  const intelligence_save = saveRaw.int !== undefined ? parseInt(saveRaw.int) : null
  const wisdom_save = saveRaw.wis !== undefined ? parseInt(saveRaw.wis) : null
  const charisma_save = saveRaw.cha !== undefined ? parseInt(saveRaw.cha) : null

  // Skills
  const skillRaw = (m.skill as Record<string, string>) ?? {}
  const skills: Record<string, number> = {}
  for (const [k, v] of Object.entries(skillRaw)) {
    skills[k.toLowerCase()] = parseInt(String(v)) || 0
  }
  const perception = typeof skills.perception === 'number' ? skills.perception : null

  // Senses
  const sensesArr = Array.isArray(m.senses)
    ? m.senses.map(String)
    : typeof m.senses === 'string'
      ? [m.senses]
      : []
  if (typeof m.passive === 'number') sensesArr.push(`passive Perception ${m.passive}`)
  const senses = sensesArr.join(', ')

  // Languages
  const langsArr = Array.isArray(m.languages)
    ? m.languages.map(String)
    : typeof m.languages === 'string'
      ? [m.languages]
      : []
  const languages = langsArr.join(', ')

  // CR
  let crStr = ''
  if (typeof m.cr === 'string') crStr = m.cr
  else if (typeof m.cr === 'object' && m.cr !== null) {
    const crObj = m.cr as Record<string, unknown>
    crStr = String(crObj.cr ?? '0')
  }
  const cr = crToNumeric(crStr)

  // Legendary description
  const legendaryHeader = Array.isArray(m.legendaryHeader) ? extractEntries(m.legendaryHeader) : ''

  return {
    slug,
    name,
    size,
    type,
    subtype,
    alignment: parseAlignment(m.alignment),
    armor_class: acData.value,
    armor_desc: acData.desc,
    hit_points,
    hit_dice,
    speed,
    strength,
    dexterity,
    constitution,
    intelligence,
    wisdom,
    charisma,
    strength_save,
    dexterity_save,
    constitution_save,
    intelligence_save,
    wisdom_save,
    charisma_save,
    perception,
    skills,
    damage_vulnerabilities: parseDamageList(m.vulnerable),
    damage_resistances: parseDamageList(m.resist),
    damage_immunities: parseDamageList(m.immune),
    condition_immunities: parseConditionImmune(m.conditionImmune),
    senses,
    languages,
    challenge_rating: crStr || '0',
    cr,
    actions: toActions(m.action),
    bonus_actions: toActions(m.bonus),
    reactions: toActions(m.reaction),
    legendary_desc: legendaryHeader,
    legendary_actions: toActions(m.legendary),
    special_abilities: toActions(m.trait),
    document__title: getSourceTitle(source),
    document__slug: source.toLowerCase(),
    dataSource: 'wotc',
  }
}

// ── 5etools import ─────────────────────────────────────────────────────────

const RAW_BASE =
  'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/bestiary'
const GITHUB_API =
  'https://api.github.com/repos/5etools-mirror-3/5etools-src/contents/data/bestiary'

async function list5etoolsFiles(): Promise<string[]> {
  console.log('Fetching 5etools bestiary file list...')
  const res = await fetch(GITHUB_API, {
    headers: { 'User-Agent': 'spelslot-import' },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
  const items = (await res.json()) as Array<{ name: string }>
  return items
    .map((i) => i.name)
    .filter(
      (n) =>
        n.startsWith('bestiary-') &&
        !n.startsWith('bestiary-fluff') &&
        !n.startsWith('bestiary-foundry') &&
        n.endsWith('.json'),
    )
    .sort()
}

async function import5etools(): Promise<void> {
  const files = await list5etoolsFiles()
  console.log(`Found ${files.length} 5etools bestiary files`)

  let totalMonsters = 0
  const BATCH_SIZE = 6

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(async (filename) => {
        try {
          const res = await fetch(`${RAW_BASE}/${filename}`, {
            headers: { 'User-Agent': 'spelslot-import' },
            signal: AbortSignal.timeout(30000),
          })
          if (!res.ok) {
            console.warn(`  Skip ${filename}: HTTP ${res.status}`)
            return
          }
          const data = (await res.json()) as { monster?: unknown[] }
          const monsters = Array.isArray(data.monster) ? data.monster : []

          const ops = monsters
            .map((m) => normalize5etools(m as Record<string, unknown>))
            .filter((m): m is Partial<IMonster> => m !== null)
            .map((m) => ({
              updateOne: {
                filter: { slug: m.slug },
                update: { $set: m },
                upsert: true,
              },
            }))

          if (ops.length > 0) {
            await Monster.bulkWrite(ops, { ordered: false })
            totalMonsters += ops.length
          }
        } catch (err) {
          console.warn(`  Error processing ${filename}:`, (err as Error).message)
        }
      }),
    )
    console.log(
      `  5etools: ${Math.min(i + BATCH_SIZE, files.length)}/${files.length} files (~${totalMonsters} monsters)`,
    )
  }

  console.log(`5etools import done: ${totalMonsters} monsters upserted`)
}

// ── Open5e import ──────────────────────────────────────────────────────────

// Skip WotC/SRD documents — covered by 5etools
const SKIP_DOCS = new Set(['wotc-srd', 'blackflag'])

// Open5e monster fields map almost directly to our schema
// We just need slug, cr (numeric), and dataSource
function normalizeOpen5e(m: Record<string, unknown>): Partial<IMonster> {
  const name = String(m.name ?? '').trim()
  const slug = toSlug(name)
  const cr_str = String(m.challenge_rating ?? '0')
  const cr = crToNumeric(cr_str)

  return {
    ...m,
    slug,
    challenge_rating: cr_str,
    cr,
    dataSource: 'third-party',
    // Ensure arrays are present even if null in API response
    actions: Array.isArray(m.actions) ? (m.actions as IMonsterAction[]) : [],
    bonus_actions: Array.isArray(m.bonus_actions) ? (m.bonus_actions as IMonsterAction[]) : [],
    reactions: Array.isArray(m.reactions) ? (m.reactions as IMonsterAction[]) : [],
    legendary_actions: Array.isArray(m.legendary_actions)
      ? (m.legendary_actions as IMonsterAction[])
      : [],
    special_abilities: Array.isArray(m.special_abilities)
      ? (m.special_abilities as IMonsterAction[])
      : [],
    legendary_desc: String(m.legendary_desc ?? ''),
    armor_desc: String(m.armor_desc ?? ''),
    senses: String(m.senses ?? ''),
    languages: String(m.languages ?? ''),
    damage_vulnerabilities: String(m.damage_vulnerabilities ?? ''),
    damage_resistances: String(m.damage_resistances ?? ''),
    damage_immunities: String(m.damage_immunities ?? ''),
    condition_immunities: String(m.condition_immunities ?? ''),
    document__title: String(m.document__title ?? ''),
    document__slug: String(m.document__slug ?? ''),
  } as Partial<IMonster>
}

interface Open5eListResponse {
  count: number
  next: string | null
  results: Record<string, unknown>[]
}

async function importOpen5e(existingSlugs: Set<string>): Promise<void> {
  // Fetch all document slugs from Open5e
  const docsRes = await fetch('https://api.open5e.com/v1/documents/?limit=50', {
    signal: AbortSignal.timeout(10000),
  })
  const docsData = (await docsRes.json()) as { results: Array<{ slug: string; title: string }> }
  const docSlugs = docsData.results
    .map((d) => d.slug)
    .filter((slug) => !SKIP_DOCS.has(slug))

  console.log(`Importing Open5e third-party documents: ${docSlugs.join(', ')}`)

  let totalInserted = 0

  for (const doc of docSlugs) {
    let url: string | null =
      `https://api.open5e.com/v1/monsters/?document__slug=${doc}&limit=100&ordering=name`
    let docCount = 0

    while (url) {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
      if (!res.ok) {
        console.warn(`  Open5e ${doc}: HTTP ${res.status}`)
        break
      }
      const data = (await res.json()) as Open5eListResponse

      const toInsert = data.results
        .map((m) => normalizeOpen5e(m))
        .filter((m) => m.slug && !existingSlugs.has(m.slug!))

      if (toInsert.length > 0) {
        const ops = toInsert.map((m) => ({
          updateOne: {
            filter: { slug: m.slug },
            update: { $setOnInsert: m },
            upsert: true,
          },
        }))
        await Monster.bulkWrite(ops, { ordered: false })

        for (const m of toInsert) existingSlugs.add(m.slug!)
        docCount += toInsert.length
        totalInserted += toInsert.length
      }

      url = data.next
    }

    if (docCount > 0) console.log(`  Open5e ${doc}: ${docCount} monsters`)
  }

  console.log(`Open5e import done: ${totalInserted} new monsters inserted`)
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  await connectDB()
  console.log('Connected to MongoDB')

  // Step 1: 5etools (WotC content) — upsert all, later sources override earlier
  await import5etools()

  // Step 2: Load all slug after 5etools import
  const existing = await Monster.find({}).select('slug').lean<Array<{ slug: string }>>()
  const existingSlugs = new Set(existing.map((m) => m.slug))
  console.log(`${existingSlugs.size} monsters in DB after 5etools import`)

  // Step 3: Open5e third-party content (Kobold Press etc.)
  await importOpen5e(existingSlugs)

  // Final count
  const total = await Monster.countDocuments()
  console.log(`\nImport complete. Total monsters in DB: ${total}`)

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('Import failed:', err)
  process.exit(1)
})
