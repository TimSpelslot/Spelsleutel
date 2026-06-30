import { Schema, model } from 'mongoose'

export interface IUser {
  uid: string
  email: string
  name: string
  displayName: string
  worldBuilderName: string | null
  dndBeyondName: string | null
  dndBeyondCampaign: number | null
  avatarUrl?: string
  role: 'PLAYER' | 'ADMIN'
  isStoryDm: boolean
  isWorldbuilder: boolean
  worldbuilderRequestPending: boolean
  worldbuilderRequestReason?: string
  dndbeyondCharacterId?: string
  karma: number
  notifySignup: boolean
  notifyAssignment: boolean
  notifyMarketplace: boolean
  notifySession: boolean
  notifyCreateAdventureReminder: boolean
  storyPlayer: boolean
  defaultRoom: string | null
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
    worldBuilderName: { type: String, default: null },
    dndBeyondName: { type: String, default: null },
    dndBeyondCampaign: { type: Number, default: null },
    avatarUrl: { type: String },
    role: { type: String, enum: ['PLAYER', 'ADMIN'], default: 'PLAYER' },
    isStoryDm: { type: Boolean, default: false },
    isWorldbuilder: { type: Boolean, default: false },
    worldbuilderRequestPending: { type: Boolean, default: false },
    worldbuilderRequestReason: { type: String },
    dndbeyondCharacterId: { type: String },
    karma: { type: Number, default: 1000 },
    notifySignup: { type: Boolean, default: true },
    notifyAssignment: { type: Boolean, default: true },
    notifyMarketplace: { type: Boolean, default: true },
    notifySession: { type: Boolean, default: true },
    notifyCreateAdventureReminder: { type: Boolean, default: false },
    storyPlayer: { type: Boolean, default: false },
    defaultRoom: { type: String, default: null },
    fcmTokens: { type: [String], default: [] },
  },
  { timestamps: true },
)

export const User = model<IUser>('User', UserSchema)
