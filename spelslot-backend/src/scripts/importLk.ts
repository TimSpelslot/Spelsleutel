import 'dotenv/config'
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import mongoose from 'mongoose'
import { connectDB } from '../config/db'
import { WorldEntry } from '../models/WorldEntry'
import { WorldDocument } from '../models/WorldDocument'
import { WorldEntryRelation } from '../models/WorldEntryRelation'
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
    entryCount++

    for (const doc of resource.documents ?? []) {
      await WorldDocument.findOneAndUpdate(
        { lkDocId: doc.id },
        {
          $set: {
            entryId: entry._id,
            name: doc.name ?? 'Page',
            type: doc.type,
            content: doc.content ?? null,
            pos: doc.pos ?? '',
            isHidden: doc.isHidden ?? false,
            isFirst: doc.isFirst ?? false,
            calendarId: doc.calendarId,
          },
          $setOnInsert: { lkDocId: doc.id },
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
      // LK stores the target resource id; field name varies by LK version
      const targetLkId =
        (link.value as Record<string, string> | undefined)?.resourceId ??
        (link.resourceId as string | undefined)
      if (!targetLkId) continue

      const targetMongoId = lkIdToMongoId.get(targetLkId)
      if (!targetMongoId) {
        skipped++
        continue
      }

      await WorldEntryRelation.findOneAndUpdate(
        { sourceId: sourceMongoId, targetId: targetMongoId },
        {
          $set: { type: (link.label as string | undefined) ?? undefined },
          $setOnInsert: { lkPropertyId: link.id },
        },
        { upsert: true },
      )
      relationCount++
    }
  }

  console.log(`[import] Upserted ${relationCount} relations (${skipped} targets not found)`)
  console.log('[import] Done!')

  await mongoose.connection.close()
}

main().catch((err) => {
  console.error('[import] Fatal error:', err)
  process.exit(1)
})
