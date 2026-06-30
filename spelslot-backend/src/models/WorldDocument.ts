import { Schema, model, Types } from 'mongoose'

export type DocType = 'page' | 'time' | 'map' | 'board'

export interface IWorldDocument {
  entryId: Types.ObjectId
  lkDocId?: string
  name: string
  type: DocType
  content: unknown
  pos: string
  isHidden: boolean
  isFirst: boolean
  calendarId?: string
  deletedAt?: Date
  deletedBy?: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const WorldDocumentSchema = new Schema<IWorldDocument>(
  {
    entryId: { type: Schema.Types.ObjectId, ref: 'WorldEntry', required: true },
    lkDocId: { type: String },
    name: { type: String, required: true, default: 'Page' },
    type: { type: String, enum: ['page', 'time', 'map', 'board'], required: true },
    content: { type: Schema.Types.Mixed },
    pos: { type: String, default: '' },
    isHidden: { type: Boolean, default: false },
    isFirst: { type: Boolean, default: false },
    calendarId: { type: String },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
)

WorldDocumentSchema.index({ entryId: 1 })
WorldDocumentSchema.index({ lkDocId: 1 }, { sparse: true })

export const WorldDocument = model<IWorldDocument>('WorldDocument', WorldDocumentSchema)
