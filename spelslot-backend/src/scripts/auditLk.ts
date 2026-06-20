/**
 * Compares a .lk export against what's actually in MongoDB.
 * Usage: tsx src/scripts/auditLk.ts <path-to-file.lk>
 */
import 'dotenv/config'
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import mongoose from 'mongoose'
import { connectDB } from '../config/db'
import { WorldEntry } from '../models/WorldEntry'
import { WorldDocument } from '../models/WorldDocument'
import { WorldEntryRelation } from '../models/WorldEntryRelation'

interface LkDocument { id: string; type: string; name?: string }
interface LkProperty { id: string; type: string; [k: string]: unknown }
interface LkResource {
  id: string; name: string; parentId?: string; isHidden?: boolean
  documents?: LkDocument[]; properties?: LkProperty[]; tags?: string[]; aliases?: string[]
}
interface LkRoot { resources: LkResource[]; resourceCount: number; exportedAt: string; exportId: string }

const RESET = '\x1b[0m'
const RED   = '\x1b[31m'
const GRN   = '\x1b[32m'
const YEL   = '\x1b[33m'
const CYN   = '\x1b[36m'
const DIM   = '\x1b[2m'
const BOLD  = '\x1b[1m'

function ok(msg: string)   { console.log(`${GRN}✓${RESET} ${msg}`) }
function warn(msg: string) { console.log(`${YEL}⚠${RESET} ${msg}`) }
function fail(msg: string) { console.log(`${RED}✗${RESET} ${msg}`) }
function info(msg: string) { console.log(`${CYN}ℹ${RESET} ${msg}`) }
function hdr(msg: string)  { console.log(`\n${BOLD}${msg}${RESET}`) }

async function main() {
  const filePath = process.argv[2]
  if (!filePath) { console.error('Usage: tsx src/scripts/auditLk.ts <file.lk>'); process.exit(1) }

  // ── Parse .lk ────────────────────────────────────────────────────────────
  const resolved = path.resolve(filePath)
  const compressed = fs.readFileSync(resolved)
  const data: LkRoot = JSON.parse(zlib.gunzipSync(compressed).toString('utf-8'))

  const lkResources = data.resources
  const lkAllDocs   = lkResources.flatMap(r => r.documents ?? [])
  const lkLinks     = lkResources.flatMap(r =>
    (r.properties ?? []).filter(p => p.type === 'RESOURCE_LINK')
  )
  const lkWithParent = lkResources.filter(r => r.parentId)
  const lkLinkTargets = lkLinks.reduce((n, l) => {
    const items = (l.data as { items?: unknown[] } | undefined)?.items
    return n + (Array.isArray(items) ? items.length : 0)
  }, 0)

  hdr('━━ LK Export ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  info(`Export ID   : ${data.exportId}`)
  info(`Exported at : ${data.exportedAt}`)
  info(`Resources   : ${lkResources.length} (resourceCount field: ${data.resourceCount})`)
  info(`Documents   : ${lkAllDocs.length} total`)
  info(`  page      : ${lkAllDocs.filter(d => d.type === 'page').length}`)
  info(`  time      : ${lkAllDocs.filter(d => d.type === 'time').length}`)
  info(`  map       : ${lkAllDocs.filter(d => d.type === 'map').length}`)
  info(`  board     : ${lkAllDocs.filter(d => d.type === 'board').length}`)
  info(`Relations   : ${lkLinks.length} RESOURCE_LINK containers (${lkLinkTargets} actual links)`)
  info(`With parent : ${lkWithParent.length} resources`)

  // ── Connect to DB ─────────────────────────────────────────────────────────
  hdr('━━ Database ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  await connectDB()

  const dbEntries = await WorldEntry.find({}, 'lkId name slug parentId permission isLocked tags aliases').lean()
  const dbDocs    = await WorldDocument.find({}, 'lkDocId entryId type').lean()
  const dbRels    = await WorldEntryRelation.find({}).lean()

  const dbLkIds   = new Set(dbEntries.map(e => e.lkId).filter(Boolean))
  const dbDocIds  = new Set(dbDocs.map(d => d.lkDocId).filter(Boolean))

  info(`WorldEntry  : ${dbEntries.length} total (${dbLkIds.size} with lkId)`)
  info(`WorldDocument: ${dbDocs.length} total`)
  info(`Relations   : ${dbRels.length}`)

  // ── Count checks ──────────────────────────────────────────────────────────
  hdr('━━ Count Checks ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  if (dbLkIds.size === lkResources.length) {
    ok(`Entries: all ${lkResources.length} LK resources found in DB`)
  } else {
    fail(`Entries: ${lkResources.length} in LK, ${dbLkIds.size} matched in DB`)
  }

  if (dbDocs.filter(d => d.lkDocId).length === lkAllDocs.length) {
    ok(`Documents: all ${lkAllDocs.length} LK docs found in DB`)
  } else {
    warn(`Documents: ${lkAllDocs.length} in LK, ${dbDocs.filter(d => d.lkDocId).length} matched in DB`)
  }

  // lkLinkTargets = actual link targets; up to 2 may be missing (targets not found in export)
  if (dbRels.length >= lkLinkTargets - 2) {
    ok(`Relations: ${dbRels.length} in DB vs ${lkLinkTargets} actual links in LK (${lkLinks.length} RESOURCE_LINK containers, most empty)`)
  } else {
    warn(`Relations: ${dbRels.length} in DB vs ${lkLinkTargets} actual links in LK (${lkLinks.length} RESOURCE_LINK containers)`)
  }

  // ── Missing entries ───────────────────────────────────────────────────────
  hdr('━━ Missing Entries ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  const missingEntries = lkResources.filter(r => !dbLkIds.has(r.id))
  if (missingEntries.length === 0) {
    ok('No missing entries')
  } else {
    fail(`${missingEntries.length} LK resources not in DB:`)
    missingEntries.slice(0, 20).forEach(r =>
      console.log(`  ${DIM}${r.id}${RESET}  "${r.name}"`)
    )
    if (missingEntries.length > 20) console.log(`  ${DIM}… and ${missingEntries.length - 20} more${RESET}`)
  }

  // ── Missing documents ─────────────────────────────────────────────────────
  hdr('━━ Missing Documents ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  const missingDocs = lkAllDocs.filter(d => !dbDocIds.has(d.id))
  if (missingDocs.length === 0) {
    ok('No missing documents')
  } else {
    fail(`${missingDocs.length} LK documents not in DB:`)
    missingDocs.slice(0, 20).forEach(d =>
      console.log(`  ${DIM}${d.id}${RESET}  type=${d.type}  "${d.name ?? '(unnamed)'}"`)
    )
    if (missingDocs.length > 20) console.log(`  ${DIM}… and ${missingDocs.length - 20} more${RESET}`)
  }

  // ── Parent resolution ─────────────────────────────────────────────────────
  hdr('━━ Parent Resolution ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  const withParentInDB = dbEntries.filter(e => e.parentId)
  const withParentInLK = lkResources.filter(r => r.parentId)
  if (withParentInDB.length === withParentInLK.length) {
    ok(`Parent refs: all ${withParentInLK.length} resolved in DB`)
  } else {
    warn(`Parent refs: ${withParentInLK.length} in LK, ${withParentInDB.length} resolved in DB`)
    // Find which ones are missing parents
    const lkIdToMongoId = new Map(dbEntries.filter(e => e.lkId).map(e => [e.lkId!, String(e._id)]))
    const missingParents = withParentInLK.filter(r => {
      const entry = dbEntries.find(e => e.lkId === r.id)
      return entry && !entry.parentId
    })
    if (missingParents.length > 0) {
      console.log(`  ${missingParents.length} entries that should have a parent but don't:`)
      missingParents.slice(0, 10).forEach(r => {
        const parentName = lkResources.find(p => p.id === r.parentId)?.name ?? r.parentId
        console.log(`  ${DIM}${r.id}${RESET}  "${r.name}" → parent: "${parentName}"`)
      })
      if (missingParents.length > 10) console.log(`  ${DIM}… and ${missingParents.length - 10} more${RESET}`)
    } else {
      ok('All entries with parents have them resolved (count mismatch may be from non-LK entries)')
    }
  }

  // ── Field spot-checks (sample 3 entries) ─────────────────────────────────
  hdr('━━ Field Spot-Checks ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  const sampleLk = lkResources.filter(r => dbLkIds.has(r.id)).slice(0, 3)
  for (const lkr of sampleLk) {
    const dbEntry = dbEntries.find(e => e.lkId === lkr.id)!
    const nameOk  = dbEntry.name === lkr.name
    const permOk  = (lkr.isHidden ? 'DM_ONLY' : 'PLAYERS') === dbEntry.permission
    const tagsOk  = JSON.stringify((dbEntry.tags ?? []).sort()) === JSON.stringify((lkr.tags ?? []).sort())
    const aliasOk = JSON.stringify((dbEntry.aliases ?? []).sort()) === JSON.stringify((lkr.aliases ?? []).sort())

    console.log(`\n  "${lkr.name}" ${DIM}(lkId: ${lkr.id})${RESET}`)
    nameOk  ? ok('  name matches') : fail(`  name mismatch: LK="${lkr.name}" DB="${dbEntry.name}"`)
    permOk  ? ok(`  permission correct (${dbEntry.permission})`) : fail(`  permission: expected ${lkr.isHidden ? 'DM_ONLY' : 'PLAYERS'}, got ${dbEntry.permission}`)
    tagsOk  ? ok(`  tags match (${(lkr.tags ?? []).join(', ') || 'none'})`) : warn(`  tags: LK=[${lkr.tags?.join(', ')}] DB=[${dbEntry.tags?.join(', ')}]`)
    aliasOk ? ok(`  aliases match (${(lkr.aliases ?? []).join(', ') || 'none'})`) : warn(`  aliases: LK=[${lkr.aliases?.join(', ')}] DB=[${dbEntry.aliases?.join(', ')}]`)
    dbEntry.slug ? ok(`  slug: "${dbEntry.slug}"`) : fail('  no slug!')
  }

  // ── Document type breakdown in DB ─────────────────────────────────────────
  hdr('━━ Document Type Breakdown (DB) ━━━━━━━━━━━━━━━━━━━')
  const dbDocTypes: Record<string, number> = {}
  dbDocs.forEach(d => { dbDocTypes[d.type] = (dbDocTypes[d.type] ?? 0) + 1 })
  Object.entries(dbDocTypes).forEach(([type, count]) =>
    info(`  ${type.padEnd(8)}: ${count}`)
  )

  // ── Entries without documents ─────────────────────────────────────────────
  hdr('━━ Entries Without Documents ━━━━━━━━━━━━━━━━━━━━━━')
  const entryIdsWithDocs = new Set(dbDocs.map(d => String(d.entryId)))
  const entriesNoDocs = dbEntries.filter(e => e.lkId && !entryIdsWithDocs.has(String(e._id)))
  if (entriesNoDocs.length === 0) {
    ok('All imported entries have at least one document')
  } else {
    warn(`${entriesNoDocs.length} imported entries have no documents:`)
    entriesNoDocs.slice(0, 15).forEach(e =>
      console.log(`  ${DIM}${e.lkId}${RESET}  "${e.name}"`)
    )
    if (entriesNoDocs.length > 15) console.log(`  ${DIM}… and ${entriesNoDocs.length - 15} more${RESET}`)
  }

  console.log(`\n${BOLD}Done.${RESET}\n`)
  await mongoose.connection.close()
}

main().catch(err => { console.error(err); process.exit(1) })
