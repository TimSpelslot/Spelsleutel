import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { Monster } from '../models/Monster'
import type { IMonster } from '../models/Monster'

export const monstersRouter = Router()

monstersRouter.use(requireAuth)

// GET /api/monsters?search=<name>   — search by name (top 15)
monstersRouter.get('/', async (req, res, next) => {
  try {
    const { search } = req.query
    if (!search || typeof search !== 'string') {
      res.status(400).json({ message: 'search parameter required' })
      return
    }

    const results = await Monster.find({ name: { $regex: search, $options: 'i' } })
      .select('slug name challenge_rating type size document__title')
      .sort({ cr: 1, name: 1 })
      .limit(15)
      .lean<Array<Pick<IMonster, 'slug' | 'name' | 'challenge_rating' | 'type' | 'size' | 'document__title'>>>()

    res.json({ results })
  } catch (err) {
    next(err)
  }
})

// POST /api/monsters/from-url — extract monster name from a URL and search DB
monstersRouter.post('/from-url', async (req, res, next) => {
  try {
    const { url } = req.body as { url?: string }
    if (!url || typeof url !== 'string') {
      res.status(400).json({ message: 'url is required' })
      return
    }

    const name = extractMonsterName(url)
    if (!name) {
      res.status(400).json({
        message:
          'Could not extract a monster name from this URL. Supported: dndbeyond.com/monsters/…, 5e.tools/bestiary.html#…',
      })
      return
    }

    const results = await Monster.find({ name: { $regex: name, $options: 'i' } })
      .sort({ cr: 1, name: 1 })
      .limit(10)
      .lean()

    if (results.length === 0) {
      res.status(404).json({
        message: `"${name}" not found. Check the monster name or use the Image tab to upload a stat block screenshot instead.`,
        extractedName: name,
      })
      return
    }

    const exact = results.find((r) => r.name?.toLowerCase() === name.toLowerCase())
    res.json({ monster: exact ?? results[0], alternatives: results.slice(0, 5), extractedName: name })
  } catch (err) {
    next(err)
  }
})

function extractMonsterName(url: string): string | null {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()

    // DnD Beyond: /monsters/16-goblin  or  /monsters/goblin
    if (host.includes('dndbeyond.com')) {
      const match = parsed.pathname.match(/\/monsters\/(?:\d+-)?(.+)/)
      if (match) return slugToName(match[1])
    }

    // 5e.tools: /bestiary.html#goblin_mm  or  /bestiary/goblin
    if (host.includes('5e.tools')) {
      const hash = parsed.hash.replace('#', '')
      if (hash) {
        // hash format: name_SOURCE — name may contain underscores before the last _source segment
        const lastUnderscore = hash.lastIndexOf('_')
        const namePart = lastUnderscore > 0 ? hash.slice(0, lastUnderscore) : hash
        return slugToName(namePart)
      }
      const pathMatch = parsed.pathname.match(/\/bestiary\/(.+)/)
      if (pathMatch) return slugToName(pathMatch[1])
    }

    // Open5e: /v1/monsters/goblin/
    if (host.includes('open5e.com')) {
      const match = parsed.pathname.match(/\/monsters\/([^/]+)/)
      if (match) return slugToName(match[1])
    }

    // Generic: last path segment that looks like a monster name
    const segments = parsed.pathname.split('/').filter(Boolean)
    const last = segments[segments.length - 1]
    if (last && last.length > 2) return slugToName(last)

    return null
  } catch {
    return null
  }
}

function slugToName(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
}

// GET /api/monsters/:slug — fetch full stat block by slug
monstersRouter.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params
    if (!/^[\w-]+$/.test(slug)) {
      res.status(400).json({ message: 'Invalid slug' })
      return
    }

    const monster = await Monster.findOne({ slug }).lean()
    if (!monster) {
      res.status(404).json({ message: 'Monster not found' })
      return
    }

    res.json({ monster })
  } catch (err) {
    next(err)
  }
})
