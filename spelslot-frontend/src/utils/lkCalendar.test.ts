import { describe, it, expect } from 'vitest'
import {
  avgMinutesPerYear,
  minutesToLabel,
  minutesToYearNumber,
  yearStartMinutes,
  type LkCalendarDef,
  type CalMonth,
  type CalLeapDay,
} from './lkCalendar'

// ── Fixture factory ──────────────────────────────────────────────────────────
//   Simple calendar: 12 months × 30 days, 24h/day, 60min/h, no leap days
//   avgMinutesPerYear = 360 × 1440 = 518400

function makeCalendar(overrides: Partial<LkCalendarDef> = {}): LkCalendarDef {
  const months: CalMonth[] = Array.from({ length: 12 }, (_, i) => ({
    id: `m${i + 1}`,
    name: `Month${i + 1}`,
    length: 30,
    isIntercalary: false,
  }))

  return {
    name: 'Test Calendar',
    hasZeroYear: false,
    hoursInDay: 24,
    minutesInHour: 60,
    months,
    leapDays: [],
    positiveEra: { id: 'ce', name: 'CE' },
    negativeEra: { id: 'bce', name: 'BCE' },
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('avgMinutesPerYear', () => {
  it('should return 360 × 1440 when there are no leap days', () => {
    const cal = makeCalendar()
    expect(avgMinutesPerYear(cal)).toBe(518400)
  })

  it('should add 0.25 × minutesInDay per leap day entry', () => {
    // ── arrange ──────────────────────────────────────────────────────────
    const leapDay: CalLeapDay = { id: 'ld1', month: 2, day: 0, interval: '4', offset: 0 }
    const cal = makeCalendar({ leapDays: [leapDay] })

    // ── act ───────────────────────────────────────────────────────────────
    const result = avgMinutesPerYear(cal)

    // ── assert ────────────────────────────────────────────────────────────
    // (360 + 0.25) × 1440 = 518760
    expect(result).toBe(518760)
  })
})

describe('minutesToYearNumber', () => {
  it('should return year 1 for 0 minutes with hasZeroYear false', () => {
    const cal = makeCalendar()
    expect(minutesToYearNumber(0, cal)).toBe(1)
  })

  it('should return year 2 after exactly one full year of minutes', () => {
    // ── arrange ──────────────────────────────────────────────────────────
    const cal = makeCalendar()
    const oneYear = avgMinutesPerYear(cal) // 518400

    // ── act + assert ──────────────────────────────────────────────────────
    expect(minutesToYearNumber(oneYear, cal)).toBe(2)
  })

  it('should return a negative year for negative minutes', () => {
    const cal = makeCalendar()
    // -518400 minutes = 1 full year before baseYear(1) → year 0
    // Math.floor(-518400 / 518400 + 1) = Math.floor(0) = 0
    expect(minutesToYearNumber(-518400, cal)).toBe(0)
  })

  it('should return year 0 for 0 minutes when hasZeroYear is true', () => {
    // ── arrange ──────────────────────────────────────────────────────────
    const cal = makeCalendar({ hasZeroYear: true })

    // ── act + assert ──────────────────────────────────────────────────────
    expect(minutesToYearNumber(0, cal)).toBe(0)
  })
})

describe('yearStartMinutes', () => {
  it('should return 0 for the base year (year 1) with hasZeroYear false', () => {
    const cal = makeCalendar()
    expect(yearStartMinutes(1, cal)).toBe(0)
  })

  it('should return avgMinutesPerYear for year 2', () => {
    // ── arrange ──────────────────────────────────────────────────────────
    const cal = makeCalendar()
    const mpy = avgMinutesPerYear(cal)

    // ── act + assert ──────────────────────────────────────────────────────
    expect(yearStartMinutes(2, cal)).toBe(mpy)
  })

  it('should return 0 for year 0 when hasZeroYear is true', () => {
    const cal = makeCalendar({ hasZeroYear: true })
    expect(yearStartMinutes(0, cal)).toBe(0)
  })

  it('should return negative minutes for years before the base year', () => {
    // ── arrange ──────────────────────────────────────────────────────────
    const cal = makeCalendar()
    const mpy = avgMinutesPerYear(cal)

    // ── act + assert ──────────────────────────────────────────────────────
    // year 0 is 1 year before baseYear(1) → -518400
    expect(yearStartMinutes(0, cal)).toBe(-mpy)
  })
})

describe('minutesToLabel precision=year', () => {
  it('should return the positive era label for 0 minutes', () => {
    const cal = makeCalendar()
    const label = minutesToLabel(0, cal, 'year')
    expect(label).toBe('1 CE')
  })

  it('should use the negativeEra name for negative minute values', () => {
    // ── arrange ──────────────────────────────────────────────────────────
    const cal = makeCalendar()
    // One full year before base → year 0, which is < baseYear(1), so negativeEra
    const oneYearBefore = -avgMinutesPerYear(cal)

    // ── act ───────────────────────────────────────────────────────────────
    const label = minutesToLabel(oneYearBefore, cal, 'year')

    // ── assert ────────────────────────────────────────────────────────────
    // year = Math.floor(-518400/518400 + 1) = Math.floor(0) = 0
    // y(0) < baseYear(1) → absY = 1 - 0 = 1 → '1 BCE'
    expect(label).toContain('BCE')
  })

  it('should use positiveEra name for year 2', () => {
    // ── arrange ──────────────────────────────────────────────────────────
    const cal = makeCalendar()
    const oneYear = avgMinutesPerYear(cal)

    // ── act + assert ──────────────────────────────────────────────────────
    expect(minutesToLabel(oneYear, cal, 'year')).toBe('2 CE')
  })

  it('should fall back to Year N format when no positiveEra is defined', () => {
    // ── arrange ──────────────────────────────────────────────────────────
    const cal = makeCalendar({ positiveEra: undefined })

    // ── act + assert ──────────────────────────────────────────────────────
    expect(minutesToLabel(0, cal, 'year')).toBe('Year 1')
  })
})

describe('minutesToLabel precision=month', () => {
  it('should return the first month name and year label for 0 minutes', () => {
    // ── arrange ──────────────────────────────────────────────────────────
    const cal = makeCalendar()

    // ── act ───────────────────────────────────────────────────────────────
    const label = minutesToLabel(0, cal, 'month')

    // ── assert ────────────────────────────────────────────────────────────
    expect(label).toContain('Month1')
    expect(label).toContain('CE')
  })

  it('should advance to the second month after 30 days of minutes', () => {
    // ── arrange ──────────────────────────────────────────────────────────
    const cal = makeCalendar()
    const minutesInDay = 24 * 60
    const thirtyDays = 30 * minutesInDay

    // ── act ───────────────────────────────────────────────────────────────
    const label = minutesToLabel(thirtyDays, cal, 'month')

    // ── assert ────────────────────────────────────────────────────────────
    expect(label).toContain('Month2')
  })
})

describe('minutesToLabel precision=day', () => {
  it('should return the first day of the first month for 0 minutes', () => {
    // ── arrange ──────────────────────────────────────────────────────────
    const cal = makeCalendar()

    // ── act ───────────────────────────────────────────────────────────────
    const label = minutesToLabel(0, cal, 'day')

    // ── assert ────────────────────────────────────────────────────────────
    expect(label).toContain('Month1')
    expect(label).toContain('1,')
    expect(label).toContain('CE')
  })

  it('should return day 2 after one day of minutes', () => {
    // ── arrange ──────────────────────────────────────────────────────────
    const cal = makeCalendar()
    const minutesInDay = 24 * 60

    // ── act ───────────────────────────────────────────────────────────────
    const label = minutesToLabel(minutesInDay, cal, 'day')

    // ── assert ────────────────────────────────────────────────────────────
    expect(label).toContain('Month1')
    expect(label).toContain('2,')
  })
})

describe('hasZeroYear calendar', () => {
  it('should return year 0 for 0 minutes when hasZeroYear is true', () => {
    // ── arrange ──────────────────────────────────────────────────────────
    const cal = makeCalendar({ hasZeroYear: true })

    // ── act ───────────────────────────────────────────────────────────────
    const year = minutesToYearNumber(0, cal)

    // ── assert ────────────────────────────────────────────────────────────
    expect(year).toBe(0)
  })

  it('should label year 0 with the positiveEra name in minutesToLabel', () => {
    // ── arrange ──────────────────────────────────────────────────────────
    const cal = makeCalendar({ hasZeroYear: true })

    // ── act ───────────────────────────────────────────────────────────────
    const label = minutesToLabel(0, cal, 'year')

    // ── assert ────────────────────────────────────────────────────────────
    // year=0 is NOT < baseYear(0), so positiveEra branch → '0 CE'
    expect(label).toBe('0 CE')
  })

  it('should return year 1 after one full year when hasZeroYear is true', () => {
    const cal = makeCalendar({ hasZeroYear: true })
    expect(minutesToYearNumber(avgMinutesPerYear(cal), cal)).toBe(1)
  })
})
