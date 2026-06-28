import { Schema, model } from 'mongoose'

export interface IUser {
  uid: string
  email: string
  name: string
  displayName: string
  avatarUrl?: string
  role: 'PLAYER' | 'DM' | 'ADMIN'
  isWorldbuilder: boolean
  worldbuilderRequestPending: boolean
  dndbeyondCharacterId?: string
  notifySignup: boolean
  notifyAssignment: boolean
  notifyMarketplace: boolean
  notifySession: boolean
  karmaBonus: number
  fcmTokens: string[]
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    uid: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    name: { type: String, required: true },
    displayName: { type: String, required: true },
    avatarUrl: { type: String },
    role: { type: String, enum: ['PLAYER', 'DM', 'ADMIN'], default: 'PLAYER' },
    isWorldbuilder: { type: Boolean, default: false },
    worldbuilderRequestPending: { type: Boolean, default: false },
    dndbeyondCharacterId: { type: String },
    notifySignup: { type: Boolean, default: true },
    notifyAssignment: { type: Boolean, default: true },
    notifyMarketplace: { type: Boolean, default: true },
    notifySession: { type: Boolean, default: true },
    karmaBonus: { type: Number, default: 0 },
    fcmTokens: { type: [String], default: [] },
  },
  { timestamps: true },
)

export const User = model<IUser>('User', UserSchema)
