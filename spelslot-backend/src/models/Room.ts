import mongoose from 'mongoose'

export interface IRoom {
  name: string
  isActive: boolean
}

const RoomSchema = new mongoose.Schema<IRoom>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export const Room = mongoose.model<IRoom>('Room', RoomSchema)
