import { Schema, model } from 'mongoose'

interface ICollabState {
  docId: string
  state: Buffer
  updatedAt: Date
}

const CollabStateSchema = new Schema<ICollabState>({
  docId: { type: String, required: true, unique: true, index: true },
  state: { type: Buffer, required: true },
  updatedAt: { type: Date, default: Date.now },
})

export default model<ICollabState>('CollabState', CollabStateSchema)
