/**
 * A single combatant tracked in the DM combat tracker (HP, AC, initiative,
 * conditions). Distinct from the Open5e `Monster` stat block in
 * `services/monsterService.ts` — a `Combatant` is mutable live combat state,
 * persisted per session in localStorage.
 */
export interface Combatant {
  id: string
  name: string
  hp: number
  maxHp: number
  ac: number
  initiative: number
  conditions: string[]
}
