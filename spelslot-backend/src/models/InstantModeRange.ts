import { Schema, model } from 'mongoose'

export interface IInstantModeRange {
  label: string | null
  startDate: Date | null
  endDate: Date | null
  isRecurring: boolean
  recurrenceWeekday: number | null  // 0=Mon … 6=Sun
  recurrenceWeekOfMonth: number | null  // 1–5
  createdAt: Date
  updatedAt: Date
}

function weekOfMonth(date: Date): number {
  return Math.ceil(date.getDate() / 7)
}

export function matchesRange(range: IInstantModeRange, date: Date): boolean {
  if (range.isRecurring) {
    const jsDay = date.getDay()
    const weekday = jsDay === 0 ? 6 : jsDay - 1  // Mon=0 … Sun=6
    if (range.recurrenceWeekday !== null && weekday !== range.recurrenceWeekday) return false
    if (range.recurrenceWeekOfMonth !== null && weekOfMonth(date) !== range.recurrenceWeekOfMonth) return false
    return true
  }
  const d = new Date(date)
  if (range.startDate) {
    const start = new Date(range.startDate); start.setHours(0, 0, 0, 0)
    if (d < start) return false
  }
  if (range.endDate) {
    const end = new Date(range.endDate); end.setHours(23, 59, 59, 999)
    if (d > end) return false
  }
  return true
}

const InstantModeRangeSchema = new Schema<IInstantModeRange>(
  {
    label: { type: String, default: null },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    isRecurring: { type: Boolean, default: false },
    recurrenceWeekday: { type: Number, default: null },
    recurrenceWeekOfMonth: { type: Number, default: null },
  },
  { timestamps: true },
)

export const InstantModeRange = model<IInstantModeRange>('InstantModeRange', InstantModeRangeSchema)
