import { Router } from 'express'
import { requireAuth } from '../middleware/auth'

export const monstersRouter = Router()

monstersRouter.use(requireAuth)

const OPEN5E_BASE = 'https://api.open5e.com/v1'

// GET /api/monsters?search=<name>   — search by name (top 10)
// GET /api/monsters/<slug>          — fetch full stat block by slug
monstersRouter.get('/', async (req, res, next) => {
  try {
    const { search } = req.query
    if (!search || typeof search !== 'string') {
      res.status(400).json({ message: 'search parameter required' })
      return
    }
    const url = `${OPEN5E_BASE}/monsters/?name__icontains=${encodeURIComponent(search)}&limit=15`
    const upstream = await fetch(url, { signal: AbortSignal.timeout(8000) })
    const data = await upstream.json() as { results?: unknown[] }
    res.json({ results: data.results ?? [] })
  } catch (err) {
    next(err)
  }
})

// POST /api/monsters/from-url — extract monster name from a URL and search Open5e
monstersRouter.post('/from-url', async (req, res, next) => {
  try {
    const { url } = req.body as { url?: string }
    if (!url || typeof url !== 'string') {
      res.status(400).json({ message: 'url is required' })
      return
    }

    const name = extractMonsterName(url)
    if (!name) {
      res.status(400).json({ message: 'Could not extract a monster name from this URL. Supported: dndbeyond.com/monsters/…, 5e.tools/bestiary.html#…' })
      return
    }

    const searchUrl = `${OPEN5E_BASE}/monsters/?name__icontains=${encodeURIComponent(name)}&limit=10`
    const upstream = await fetch(searchUrl, { signal: AbortSignal.timeout(8000) })
    const data = await upstream.json() as { results?: Record<string, unknown>[] }
    const results = data.results ?? []

    if (results.length === 0) {
      res.status(404).json({
        message: `"${name}" not found in Open5e. Non-SRD/non-published monsters aren't in the database — use the Image tab to upload a stat block screenshot instead.`,
        extractedName: name,
      })
      return
    }

    // Prefer exact name match; fall back to first result
    const exact = results.find((r) => (r.name as string)?.toLowerCase() === name.toLowerCase())
    res.json({ monster: exact ?? results[0], alternatives: results.slice(0, 5) })
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
  return slug
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

monstersRouter.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params
    if (!/^[\w-]+$/.test(slug)) {
      res.status(400).json({ message: 'Invalid slug' })
      return
    }
    const url = `${OPEN5E_BASE}/monsters/${slug}/`
    const upstream = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (upstream.status === 404) {
      res.status(404).json({ message: 'Monster not found' })
      return
    }
    const data = await upstream.json()
    res.json(data)
  } catch (err) {
    next(err)
  }
})
