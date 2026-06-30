export type UserRole = 'PLAYER' | 'ADMIN'

export interface User {
  id: string
  uid: string
  email: string
  name: string
  displayName: string
  worldBuilderName: string | null
  dndBeyondName: string | null
  dndBeyondCampaign: number | null
  avatarUrl: string | null
  role: UserRole
  isStoryDm: boolean
  isWorldbuilder: boolean
  worldbuilderRequestPending: boolean
  dndbeyondCharacterId: string | null
  karma: number
  notifySignup: boolean
  notifyAssignment: boolean
  notifyMarketplace: boolean
  notifySession: boolean
  notifyCreateAdventureReminder: boolean
}
