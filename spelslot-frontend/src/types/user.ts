export type UserRole = 'PLAYER' | 'DM' | 'ADMIN'

export interface User {
  id: string
  uid: string
  email: string
  name: string
  displayName: string
  avatarUrl: string | null
  role: UserRole
  isWorldbuilder: boolean
  worldbuilderRequestPending: boolean
  dndbeyondCharacterId: string | null
  notifySignup: boolean
  notifyAssignment: boolean
  notifyMarketplace: boolean
  notifySession: boolean
}
