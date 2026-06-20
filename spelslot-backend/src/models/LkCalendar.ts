import mongoose, { Schema, Document } from 'mongoose'

export interface ILkCalendar extends Document {
  lkCalendarId: string
  name: string
  hasZeroYear: boolean
  hoursInDay: number
  minutesInHour: number
  months: { id: string; name: string; length: number; isIntercalary: boolean }[]
  leapDays: { id: string; month: number; day: number; interval: string; offset: number }[]
  weekdays: { id: string; name: string }[]
  negativeEra?: { id: string; name: string; abbr?: string }
  positiveEra?: { id: string; name: string; abbr?: string }
}

const schema = new Schema<ILkCalendar>({
  lkCalendarId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  hasZeroYear: { type: Boolean, default: false },
  hoursInDay: { type: Number, default: 24 },
  minutesInHour: { type: Number, default: 60 },
  months: [{ id: String, name: String, length: Number, isIntercalary: Boolean }],
  leapDays: [{ id: String, month: Number, day: Number, interval: String, offset: Number }],
  weekdays: [{ id: String, name: String }],
  negativeEra: { id: String, name: String, abbr: String },
  positiveEra: { id: String, name: String, abbr: String },
})

export const LkCalendar = mongoose.model<ILkCalendar>('LkCalendar', schema)
