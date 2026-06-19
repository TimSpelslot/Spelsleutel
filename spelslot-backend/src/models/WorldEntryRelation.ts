import { Schema, model, Types } from 'mongoose'

export interface IWorldEntryRelation {
  sourceId: Types.ObjectId
  targetId: Types.ObjectId
  type?: string
  lkPropertyId?: string
  createdAt: Date
  updatedAt: Date
}

const WorldEntryRelationSchema = new Schema<IWorldEntryRelation>(
  {
    sourceId: { type: Schema.Types.ObjectId, ref: 'WorldEntry', required: true },
    targetId: { type: Schema.Types.ObjectId, ref: 'WorldEntry', required: true },
    type: { type: String },
    lkPropertyId: { type: String },
  },
  { timestamps: true },
)

WorldEntryRelationSchema.index({ sourceId: 1, targetId: 1 }, { unique: true })

export const WorldEntryRelation = model<IWorldEntryRelation>('WorldEntryRelation', WorldEntryRelationSchema)
