import slugify from 'slugify'
import { WorldEntry } from '../models/WorldEntry'

export function toSlug(name: string): string {
  return slugify(name, { lower: true, strict: true, trim: true }).substring(0, 80) || 'entry'
}

export async function uniqueSlug(name: string, excludeId?: string): Promise<string> {
  const base = toSlug(name)
  let slug = base
  let i = 2
  while (true) {
    const existing = await WorldEntry.findOne({ slug }).lean()
    if (!existing || existing._id.toString() === excludeId) break
    slug = `${base}-${i++}`
  }
  return slug
}
