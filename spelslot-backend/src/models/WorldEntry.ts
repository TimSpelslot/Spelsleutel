import { Schema, model, Types } from 'mongoose'

export type EntryType =
  | 'lore'
  | 'location'
  | 'npc'
  | 'faction'
  | 'item'
  | 'event'
  | 'rule'
  | 'session'
export type EntryStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type EntryPermission = 'PUBLIC' | 'PLAYERS' | 'DM_ONLY' | 'PRIVATE'

export interface IWorldEntry {
  lkId?: string
  abSessionId?: number
  name: string
  slug: string
  type: EntryType
  status: EntryStatus
  permission: EntryPermission
  isLocked: boolean
  parentId?: Types.ObjectId
  pos: string
  aliases: string[]
  tags: string[]
  iconColor?: string
  iconGlyph?: string
  iconShape?: string
  banner: { enabled: boolean; url: string; yPosition: number }
  summary?: string
  authorId?: Types.ObjectId
  editors: Types.ObjectId[]
  lkProperties: unknown[]
  deletedAt?: Date
  deletedBy?: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const BannerSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    url: { type: String, default: '' },
    yPosition: { type: Number, default: 50 },
  },
  { _id: false },
)

const WorldEntrySchema = new Schema<IWorldEntry>(
  {
    lkId: { type: String },
    abSessionId: { type: Number },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: ['lore', 'location', 'npc', 'faction', 'item', 'event', 'rule', 'session'],
      required: true,
    },
    status: { type: String, enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'], default: 'PUBLISHED' },
    permission: {
      type: String,
      enum: ['PUBLIC', 'PLAYERS', 'DM_ONLY', 'PRIVATE'],
      default: 'PLAYERS',
    },
    isLocked: { type: Boolean, default: false },
    parentId: { type: Schema.Types.ObjectId, ref: 'WorldEntry' },
    pos: { type: String, default: '' },
    aliases: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    iconColor: { type: String },
    iconGlyph: { type: String },
    iconShape: { type: String },
    banner: { type: BannerSchema, default: () => ({ enabled: false, url: '', yPosition: 50 }) },
    summary: { type: String },
    authorId: { type: Schema.Types.ObjectId, ref: 'User' },
    editors: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    lkProperties: { type: [Schema.Types.Mixed], default: [] },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
)

WorldEntrySchema.index({ lkId: 1 }, { sparse: true, unique: true })
WorldEntrySchema.index({ abSessionId: 1 }, { sparse: true, unique: true })

export const WorldEntry = model<IWorldEntry>('WorldEntry', WorldEntrySchema)
