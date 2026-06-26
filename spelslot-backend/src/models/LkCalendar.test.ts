import { describe, it, expect } from 'vitest'
import { LkCalendar, type ILkCalendar } from './LkCalendar'

function makeCalendar(overrides: Partial<ILkCalendar> = {}) {
  return new LkCalendar({
    lkCalendarId: 'cal-1',
    name: 'Harptos',
    ...overrides,
  })
}

describe('LkCalendar model', () => {
  it('should validate a minimal valid calendar', () => {
    const err = makeCalendar().validateSync()
    expect(err).toBeUndefined()
  })

  it('should require lkCalendarId and name', () => {
    // ── act ───────────────────────────────────────────────────────────────
    const err = new LkCalendar({}).validateSync()

    // ── assert ────────────────────────────────────────────────────────────
    expect(err?.errors.lkCalendarId).toBeDefined()
    expect(err?.errors.name).toBeDefined()
  })

  it('should default hasZeroYear, hoursInDay and minutesInHour', () => {
    const cal = makeCalendar()

    expect(cal.hasZeroYear).toBe(false)
    expect(cal.hoursInDay).toBe(24)
    expect(cal.minutesInHour).toBe(60)
  })

  it('should accept nested months, weekdays and eras', () => {
    const err = makeCalendar({
      months: [{ id: 'm1', name: 'Hammer', length: 30, isIntercalary: false }],
      weekdays: [{ id: 'w1', name: 'First' }],
      positiveEra: { id: 'e1', name: 'Dale Reckoning', abbr: 'DR' },
    }).validateSync()

    expect(err).toBeUndefined()
  })
})
