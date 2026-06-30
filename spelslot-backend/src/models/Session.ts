import { Schema, Types, model } from 'mongoose'

export type SessionStatus = 'draft' | 'open' | 'confirmed' | 'completed' | 'cancelled'

export interface ISession {
  title: string
  shortDescription: string
  date: Date
  dmId: Types.ObjectId
  maxPlayers: number
  status: SessionStatus
  tags: string[]
  isStoryAdventure: boolean
  excludeFromKarma: boolean
  rankCombat: number
  rankExploration: number
  rankRoleplaying: number
  releaseAssignments: boolean
  codexEntryId?: Types.ObjectId
  requestedPlayerIds: Types.ObjectId[]
  isWaitingList: boolean
  requestedRoom: string | null
  assignedRoom: string | null
  predecessorId: Types.ObjectId | null
  numSessions: number
  sessionNumber: number
  createdAt: Date
  updatedAt: Date
}

const SessionSchema = new Schema<ISession>(
  {
    title: { type: String, required: true, trim: true },
    shortDescription: { type: String, default: '' },
    date: { type: Date, required: true },
    dmId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    maxPlayers: { type: Number, required: true, min: 1, max: 20, default: 5 },
    status: {
      type: String,
      enum: ['draft', 'open', 'confirmed', 'completed', 'cancelled'],
      default: 'draft',
    },
    tags: { type: [String], default: [] },
    isStoryAdventure: { type: Boolean, default: false },
    excludeFromKarma: { type: Boolean, default: false },
    rankCombat: { type: Number, min: 1, max: 3, default: 2 },
    rankExploration: { type: Number, min: 1, max: 3, default: 2 },
    rankRoleplaying: { type: Number, min: 1, max: 3, default: 2 },
    releaseAssignments: { type: Boolean, default: false },
    codexEntryId: { type: Schema.Types.ObjectId, ref: 'WorldEntry' },
    requestedPlayerIds: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    isWaitingList: { type: Boolean, default: false },
    requestedRoom: { type: String, default: null },
    assignedRoom: { type: String, default: null },
    predecessorId: { type: Schema.Types.ObjectId, ref: 'Session', default: null },
    numSessions: { type: Number, min: 1, max: 4, default: 1 },
    sessionNumber: { type: Number, min: 1, max: 4, default: 1 },
  },
  { timestamps: true },
)

SessionSchema.index({ date: 1, status: 1 })
SessionSchema.index({ dmId: 1 })

export const Session = model<ISession>('Session', SessionSchema)
