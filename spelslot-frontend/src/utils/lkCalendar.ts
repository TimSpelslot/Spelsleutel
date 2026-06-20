export interface CalMonth {
  id: string
  name: string
  length: number
  isIntercalary: boolean
}

export interface CalLeapDay {
  id: string
  month: number
  day: number
  interval: string
  offset: number
}

export interface LkCalendarDef {
  lkCalendarId?: string
  name: string
  hasZeroYear: boolean
  hoursInDay: number
  minutesInHour: number
  months: CalMonth[]
  leapDays: CalLeapDay[]
  negativeEra?: { id: string; name: string; abbr?: string }
  positiveEra?: { id: string; name: string; abbr?: string }
}

export function avgMinutesPerYear(cal: LkCalendarDef): number {
  const minutesInDay = cal.minutesInHour * cal.hoursInDay
  const baseDays = cal.months.reduce((s, m) => s + m.length, 0)
  // Approximate leap day contribution: 1 day every 4 years ≈ +0.25/year
  const leapContrib = cal.leapDays.length * 0.25
  return (baseDays + leapContrib) * minutesInDay
}

export function minutesToLabel(
  minutes: number,
  cal: LkCalendarDef,
  precision: 'year' | 'month' | 'day' = 'year',
): string {
  const mpy = avgMinutesPerYear(cal)
  const baseYear = cal.hasZeroYear ? 0 : 1
  const minutesInDay = cal.minutesInHour * cal.hoursInDay

  // Find the year
  const floatYear = minutes / mpy + baseYear
  const year = Math.floor(floatYear)

  function yearLabel(y: number): string {
    if (y < baseYear) {
      const absY = baseYear - y
      const era = cal.negativeEra?.name ?? 'Before Epoch'
      return `${absY} ${era}`
    }
    if (cal.positiveEra?.name) return `${y} ${cal.positiveEra.name}`
    return `Year ${y}`
  }

  if (precision === 'year') return yearLabel(year)

  // Compute within-year position for month/day
  const yearStartMinutes = (year - baseYear) * mpy
  let remaining = minutes - yearStartMinutes

  let monthName = cal.months[0]?.name ?? 'Month 1'
  for (const m of cal.months) {
    const mLen = m.length * minutesInDay
    if (remaining < mLen) {
      monthName = m.name
      break
    }
    remaining -= mLen
    if (remaining < 0) {
      monthName = m.name
      remaining = 0
      break
    }
  }
  const day = Math.max(1, Math.floor(remaining / minutesInDay) + 1)

  if (precision === 'month') return `${monthName}, ${yearLabel(year)}`
  return `${monthName} ${day}, ${yearLabel(year)}`
}

// Year number for a given minute value (used for tick generation)
export function minutesToYearNumber(minutes: number, cal: LkCalendarDef): number {
  const mpy = avgMinutesPerYear(cal)
  const baseYear = cal.hasZeroYear ? 0 : 1
  return Math.floor(minutes / mpy + baseYear)
}

// Minute position of the start of a given year
export function yearStartMinutes(year: number, cal: LkCalendarDef): number {
  const mpy = avgMinutesPerYear(cal)
  const baseYear = cal.hasZeroYear ? 0 : 1
  return (year - baseYear) * mpy
}
