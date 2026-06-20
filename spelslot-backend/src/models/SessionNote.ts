import { Schema, model } from 'mongoose'

export type NoteType = 'player' | 'dm'

export interface ISessionNote {
  uid: string
  sessionId: string
  noteType: NoteType
  name: string
  content: object
  order: number
  createdAt: Date
  updatedAt: Date
}

const SessionNoteSchema = new Schema<ISessionNote>(
  {
    uid: { type: String, required: true },
    sessionId: { type: String, required: true },
    noteType: { type: String, enum: ['player', 'dm'], required: true },
    name: { type: String, required: true, default: 'Note 1' },
    content: { type: Schema.Types.Mixed, required: true, default: {} },
    order: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
)

// Fast lookup of all notes for a user+session+type
SessionNoteSchema.index({ uid: 1, sessionId: 1, noteType: 1 })

export const SessionNote = model<ISessionNote>('SessionNote', SessionNoteSchema)
