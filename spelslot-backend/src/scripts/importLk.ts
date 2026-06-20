import 'dotenv/config'
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import mongoose from 'mongoose'
import { connectDB } from '../config/db'
import { WorldEntry } from '../models/WorldEntry'
import { WorldDocument } from '../models/WorldDocument'
import { WorldEntryRelation } from '../models/WorldEntryRelation'
import { LkCalendar } from '../models/LkCalendar'
import { toSlug } from '../utils/slug'

// ── LK format types ───────────────────────────────────────────────────────

interface LkDocument {
  id: string
  type: 'page' | 'time' | 'map' | 'board'
  name?: string
  content: unknown
  pos?: string
  isHidden?: boolean
  isFirst?: boolean
  calendarId?: string
}

interface LkProperty {
  id: string
  type: string
  [key: string]: unknown
}

interface LkResource {
  id: string
  name: string
  parentId?: string
  pos?: string
  isHidden?: boolean
  isLocked?: boolean
  tags?: string[]
  aliases?: string[]
  iconColor?: string
  iconGlyph?: string
  iconShape?: string
  banner?: { enabled: boolean; url: string; yPosition: number }
  documents?: LkDocument[]
  properties?: LkProperty[]
}

interface LkRoot {
  version: number
  exportId: string
  exportedAt: string
  resources: LkResource[]
  resourceCount: number
}

// ── Helpers ───────────────────────────────────────────────────────────────

// Walk ProseMirror JSON and replace mention nodes that still use raw lkIds
// with resolved slug (id) + entry name (label). Idempotent: skips nodes
// that already have a label set.
function enrichMentionNodes(
  node: unknown,
  slugMap: Map<string, string>,
  nameMap: Map<string, string>,
): { changed: boolean; node: unknown } {
  if (!node || typeof node !== 'object') return { changed: false, node }
  const n = node as Record<string, unknown>

  if (n.type === 'mention' && n.attrs && typeof n.attrs === 'object') {
    const attrs = n.attrs as Record<string, unknown>
    if (typeof attrs.id === 'string' && !attrs.label) {
      const slug = slugMap.get(attrs.id)
      const name = nameMap.get(attrs.id)
      if (slug && name) {
        return { changed: true, node: { ...n, attrs: { ...attrs, id: slug, label: name } } }
      }
    }
  }

  if (Array.isArray(n.content)) {
    let changed = false
    const content = n.content.map((child) => {
      const result = enrichMentionNodes(child, slugMap, nameMap)
      if (result.changed) changed = true
      return result.node
    })
    if (changed) return { changed: true, node: { ...n, content } }
  }

  return { changed: false, node }
}

const TYPE_TAGS = new Set(['location', 'npc', 'faction', 'item', 'event', 'rule', 'session'])

function inferType(tags: string[]): string {
  for (const tag of tags) {
    const lower = tag.toLowerCase()
    if (TYPE_TAGS.has(lower)) return lower
  }
  return 'lore'
}

function makeSlugLocal(name: string, taken: Set<string>): string {
  const base = toSlug(name)
  let slug = base
  let i = 2
  while (taken.has(slug)) slug = `${base}-${i++}`
  taken.add(slug)
  return slug
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Usage: tsx src/scripts/importLk.ts <path-to-file.lk>')
    process.exit(1)
  }

  const resolved = path.resolve(filePath)
  console.log(`[import] Reading ${resolved}`)

  const compressed = fs.readFileSync(resolved)
  const decompressed = zlib.gunzipSync(compressed)
  const data: LkRoot = JSON.parse(decompressed.toString('utf-8'))

  console.log(`[import] ${data.resources.length} resources in export (exportId: ${data.exportId})`)

  await connectDB()

  // Name map from export (for mention enrichment in pass 4)
  const lkIdToName = new Map<string, string>(data.resources.map((r) => [r.id, r.name]))

  // Pre-load existing slugs and lkId→ObjectId map
  const existing = await WorldEntry.find({}, 'lkId slug').lean()
  const lkIdToMongoId = new Map(existing.filter((e) => e.lkId).map((e) => [e.lkId!, e._id]))
  const lkIdToSlug = new Map(existing.filter((e) => e.lkId).map((e) => [e.lkId!, e.slug]))
  const allSlugs = new Set(existing.map((e) => e.slug))

  // ── Pass 1: upsert entries and documents ──────────────────────────────
  console.log('[import] Pass 1: upserting entries and documents...')
  let entryCount = 0
  let docCount = 0

  for (const resource of data.resources) {
    const existingSlug = lkIdToSlug.get(resource.id)
    const slug = existingSlug ?? makeSlugLocal(resource.name, allSlugs)

    // Separate RESOURCE_LINK props from the rest (relations handled in pass 3)
    const otherProps = (resource.properties ?? []).filter((p) => p.type !== 'RESOURCE_LINK')

    const entry = await WorldEntry.findOneAndUpdate(
      { lkId: resource.id },
      {
        $set: {
          name: resource.name,
          type: inferType(resource.tags ?? []),
          permission: resource.isHidden ? 'DM_ONLY' : 'PLAYERS',
          isLocked: resource.isLocked ?? false,
          pos: resource.pos ?? '',
          aliases: resource.aliases ?? [],
          tags: resource.tags ?? [],
          iconColor: resource.iconColor,
          iconGlyph: resource.iconGlyph,
          iconShape: resource.iconShape,
          banner: resource.banner ?? { enabled: false, url: '', yPosition: 50 },
          lkProperties: otherProps,
          status: 'PUBLISHED',
        },
        $setOnInsert: { slug, lkId: resource.id },
      },
      { upsert: true, new: true },
    )

    lkIdToMongoId.set(resource.id, entry._id)
    lkIdToSlug.set(resource.id, entry.slug)
    entryCount++

    for (const doc of resource.documents ?? []) {
      // Upsert by (entryId, lkDocId) — some LK exports reuse lkDocIds across
      // different resources; keying on entryId ensures each entry keeps its own
      // document records rather than having them stolen by a later sibling.
      await WorldDocument.findOneAndUpdate(
        { entryId: entry._id, lkDocId: doc.id },
        {
          $set: {
            name: doc.name ?? 'Page',
            type: doc.type,
            content: doc.content ?? null,
            pos: doc.pos ?? '',
            isHidden: doc.isHidden ?? false,
            isFirst: doc.isFirst ?? false,
            calendarId: doc.calendarId,
          },
          $setOnInsert: { entryId: entry._id, lkDocId: doc.id },
        },
        { upsert: true },
      )
      docCount++
    }
  }

  console.log(`[import] Upserted ${entryCount} entries, ${docCount} documents`)

  // ── Pass 2: resolve parentId references ───────────────────────────────
  console.log('[import] Pass 2: resolving parent references...')
  let parentCount = 0

  for (const resource of data.resources) {
    if (!resource.parentId) continue
    const parentMongoId = lkIdToMongoId.get(resource.parentId)
    if (!parentMongoId) {
      console.warn(`[import] Parent not found for "${resource.name}" (lkId: ${resource.parentId})`)
      continue
    }
    await WorldEntry.updateOne({ lkId: resource.id }, { $set: { parentId: parentMongoId } })
    parentCount++
  }

  console.log(`[import] Resolved ${parentCount} parent references`)

  // ── Pass 3: upsert RESOURCE_LINK relations ────────────────────────────
  console.log('[import] Pass 3: upserting relations...')
  let relationCount = 0
  let skipped = 0

  for (const resource of data.resources) {
    const sourceMongoId = lkIdToMongoId.get(resource.id)
    if (!sourceMongoId) continue

    const links = (resource.properties ?? []).filter((p) => p.type === 'RESOURCE_LINK')
    for (const link of links) {
      // LK stores targets in data.items[].resourceId (each property can have
      // multiple targets). Fall back to the flat fields for older LK versions.
      const items = (link.data as { items?: { resourceId: string }[] } | undefined)?.items
      const targetIds: string[] = items?.length
        ? items.map((i) => i.resourceId).filter(Boolean)
        : [
            (link.value as Record<string, string> | undefined)?.resourceId ?? '',
            (link.resourceId as string | undefined) ?? '',
          ].filter(Boolean)

      const linkLabel = (link.title as string | undefined) ?? (link.label as string | undefined)

      for (const targetLkId of targetIds) {
        const targetMongoId = lkIdToMongoId.get(targetLkId)
        if (!targetMongoId) {
          skipped++
          continue
        }
        await WorldEntryRelation.findOneAndUpdate(
          { sourceId: sourceMongoId, targetId: targetMongoId },
          {
            $set: { type: linkLabel ?? undefined },
            $setOnInsert: { lkPropertyId: link.id },
          },
          { upsert: true },
        )
        relationCount++
      }
    }
  }

  console.log(`[import] Upserted ${relationCount} relations (${skipped} targets not found)`)

  // ── Pass 4: enrich inline mention nodes in page documents ─────────────
  console.log('[import] Pass 4: enriching inline mention nodes...')
  let mentionDocCount = 0
  const pageDocs = await WorldDocument.find({ type: 'page' }).lean()
  for (const doc of pageDocs) {
    if (!doc.content) continue
    const result = enrichMentionNodes(doc.content, lkIdToSlug, lkIdToName)
    if (result.changed) {
      await WorldDocument.findByIdAndUpdate(doc._id, { $set: { content: result.node } })
      mentionDocCount++
    }
  }
  console.log(`[import] Enriched inline mentions in ${mentionDocCount} documents`)

  // ── Calendars: upsert all calendar definitions ───────────────────────────
  console.log('[import] Importing calendars...')
  let calCount = 0
  for (const cal of (data as unknown as { calendars?: Record<string, unknown>[] }).calendars ?? []) {
    await LkCalendar.findOneAndUpdate(
      { lkCalendarId: cal.id as string },
      {
        $set: {
          name: (cal.name as string) ?? 'Unknown',
          hasZeroYear: (cal.hasZeroYear as boolean) ?? false,
          hoursInDay: (cal.hoursInDay as number) ?? 24,
          minutesInHour: (cal.minutesInHour as number) ?? 60,
          months: ((cal.months as Record<string, unknown>[]) ?? []).map((m) => ({
            id: m.id, name: m.name, length: m.length, isIntercalary: m.isIntercalary ?? false,
          })),
          leapDays: ((cal.leapDays as Record<string, unknown>[]) ?? []).map((l) => ({
            id: l.id, month: l.month ?? 0, day: l.day ?? 0, interval: l.interval ?? '', offset: l.offset ?? 0,
          })),
          weekdays: ((cal.weekdays as Record<string, unknown>[]) ?? []).map((w) => ({ id: w.id, name: w.name })),
          negativeEra: cal.negativeEra
            ? { id: (cal.negativeEra as Record<string, unknown>).id, name: (cal.negativeEra as Record<string, unknown>).name, abbr: (cal.negativeEra as Record<string, unknown>).abbr }
            : undefined,
          positiveEra: cal.positiveEra
            ? { id: (cal.positiveEra as Record<string, unknown>).id, name: (cal.positiveEra as Record<string, unknown>).name, abbr: (cal.positiveEra as Record<string, unknown>).abbr }
            : undefined,
        },
      },
      { upsert: true },
    )
    calCount++
  }
  console.log(`[import] Upserted ${calCount} calendars`)

  // ── Pass 5: resolve timeline event URIs to Codex slugs ───────────────────
  console.log('[import] Pass 5: resolving timeline event URIs...')
  let timelineEnrichedCount = 0
  const timeDocs = await WorldDocument.find({ type: 'time' }).lean()
  for (const doc of timeDocs) {
    if (!doc.content) continue
    const content = doc.content as { lanes?: unknown[]; events?: Record<string, unknown>[] }
    if (!Array.isArray(content.events) || !content.events.length) continue

    let changed = false
    const enrichedEvents = content.events.map((event) => {
      const uri = event.uri as string | undefined
      if (!uri) return event
      const match = uri.match(/^lk:\/\/resources\/([^/]+)/)
      if (!match) return event
      const slug = lkIdToSlug.get(match[1])
      if (!slug || event.slug === slug) return event
      changed = true
      return { ...event, slug }
    })

    if (changed) {
      await WorldDocument.findByIdAndUpdate(doc._id, { $set: { content: { ...content, events: enrichedEvents } } })
      timelineEnrichedCount++
    }
  }
  console.log(`[import] Enriched URIs in ${timelineEnrichedCount} timeline documents`)

  console.log('[import] Done!')

  await mongoose.connection.close()
}

main().catch((err) => {
  console.error('[import] Fatal error:', err)
  process.exit(1)
})
