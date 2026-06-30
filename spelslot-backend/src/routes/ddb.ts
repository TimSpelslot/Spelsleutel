import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { DdbCharacterCache } from '../models/DdbCharacterCache'
import { parseCharacter } from '../lib/ddb/parseCharacter'

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
      res
        .status(400)
        .json({ message: 'Character ID must be a number or a DnD Beyond character URL' })
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
      res.status(502).json({
        message: `DnD Beyond returned ${fetchRes.status}. The service may be temporarily unavailable.`,
      })
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
