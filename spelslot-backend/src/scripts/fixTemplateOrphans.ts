/**
 * One-time fix: creates a synthetic "Templates" WorldEntry and reparents the
 * 8 LK template entries whose parent was the built-in LK "templates" system
 * folder (not exported). Sets the new parent to DM_ONLY so players don't see it.
 *
 * Usage: tsx src/scripts/fixTemplateOrphans.ts
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '../config/db'
import { WorldEntry } from '../models/WorldEntry'

// lkIds of the 8 orphaned template entries (parentId was 'templates' in LK)
const ORPHAN_LK_IDS = [
  'cud23l5c', // Default Templates
  'e3vx6wj1', // Location
  'hq5e9mpd', // Faction
  'if3im38h', // Neighborhood / District
  'qjsl57ro', // NPC-Statblock
  'tf53w16p', // Subfaction
  'z78yeryj', // Untitled
  'gni4jk6x', // Adventure report
]

async function main() {
  await connectDB()

  // Find a pos value that sorts after all current root-level entries
  const lastRoot = await WorldEntry.findOne({ parentId: { $exists: false } })
    .sort({ pos: -1 })
    .select('pos')
    .lean()
  // Simple pos: append '~' after the last root pos — sorts after any alphanumeric pos
  const pos = (lastRoot?.pos ?? '') + '~'

  // Create or find the Templates parent entry (idempotent)
  const existing = await WorldEntry.findOne({ slug: 'templates' }).lean()
  let parentId: mongoose.Types.ObjectId
  if (!existing) {
    const created = await WorldEntry.create({
      name: 'Templates',
      slug: 'templates',
      type: 'lore',
      status: 'PUBLISHED',
      permission: 'DM_ONLY',
      isLocked: true,
      pos,
      aliases: [],
      tags: [],
      banner: { enabled: false, url: '', yPosition: 50 },
    })
    parentId = created._id
    console.log(`Created "Templates" entry (id: ${parentId})`)
  } else {
    parentId = existing._id
    console.log(`"Templates" entry already exists (id: ${parentId})`)
  }

  // Reparent the 8 orphaned entries
  const result = await WorldEntry.updateMany(
    { lkId: { $in: ORPHAN_LK_IDS }, parentId: { $exists: false } },
    { $set: { parentId } },
  )
  console.log(`Reparented ${result.modifiedCount} template entries under "Templates"`)

  await mongoose.connection.close()
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
