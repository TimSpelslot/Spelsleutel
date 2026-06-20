import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { LkCalendar } from '../models/LkCalendar'

export const calendarsRouter = Router()
calendarsRouter.use(requireAuth)

calendarsRouter.get('/:id', async (req, res, next) => {
  try {
    const cal = await LkCalendar.findOne({ lkCalendarId: req.params.id }).lean()
    if (!cal) {
      res.status(404).json({ message: 'Calendar not found' })
      return
    }
    res.json(cal)
  } catch (err) {
    next(err)
  }
})
