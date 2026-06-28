import { Schema, model } from 'mongoose'

export interface IMonsterAction {
  name: string
  desc: string
  attack_bonus?: number
  damage_dice?: string
  damage_bonus?: number
}

const actionSchema = new Schema<IMonsterAction>(
  {
    name: { type: String, default: '' },
    desc: { type: String, default: '' },
    attack_bonus: Number,
    damage_dice: String,
    damage_bonus: Number,
  },
  { _id: false },
)

export interface IMonster {
  slug: string
  name: string
  size: string
  type: string
  subtype: string
  alignment: string
  armor_class: number
  armor_desc: string
  hit_points: number
  hit_dice: string
  speed: Record<string, number>
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
  strength_save: number | null
  dexterity_save: number | null
  constitution_save: number | null
  intelligence_save: number | null
  wisdom_save: number | null
  charisma_save: number | null
  perception: number | null
  skills: Record<string, number>
  damage_vulnerabilities: string
  damage_resistances: string
  damage_immunities: string
  condition_immunities: string
  senses: string
  languages: string
  challenge_rating: string
  cr: number
  actions: IMonsterAction[]
  bonus_actions: IMonsterAction[]
  reactions: IMonsterAction[]
  legendary_desc: string
  legendary_actions: IMonsterAction[]
  special_abilities: IMonsterAction[]
  document__title: string
  document__slug: string
  dataSource: 'wotc' | 'third-party'
}

const MonsterSchema = new Schema<IMonster>(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    size: { type: String, default: '' },
    type: { type: String, default: '' },
    subtype: { type: String, default: '' },
    alignment: { type: String, default: '' },
    armor_class: { type: Number, default: 10 },
    armor_desc: { type: String, default: '' },
    hit_points: { type: Number, default: 0 },
    hit_dice: { type: String, default: '' },
    speed: { type: Schema.Types.Mixed, default: {} },
    strength: { type: Number, default: 10 },
    dexterity: { type: Number, default: 10 },
    constitution: { type: Number, default: 10 },
    intelligence: { type: Number, default: 10 },
    wisdom: { type: Number, default: 10 },
    charisma: { type: Number, default: 10 },
    strength_save: { type: Number, default: null },
    dexterity_save: { type: Number, default: null },
    constitution_save: { type: Number, default: null },
    intelligence_save: { type: Number, default: null },
    wisdom_save: { type: Number, default: null },
    charisma_save: { type: Number, default: null },
    perception: { type: Number, default: null },
    skills: { type: Schema.Types.Mixed, default: {} },
    damage_vulnerabilities: { type: String, default: '' },
    damage_resistances: { type: String, default: '' },
    damage_immunities: { type: String, default: '' },
    condition_immunities: { type: String, default: '' },
    senses: { type: String, default: '' },
    languages: { type: String, default: '' },
    challenge_rating: { type: String, default: '0' },
    cr: { type: Number, default: 0 },
    actions: { type: [actionSchema], default: [] },
    bonus_actions: { type: [actionSchema], default: [] },
    reactions: { type: [actionSchema], default: [] },
    legendary_desc: { type: String, default: '' },
    legendary_actions: { type: [actionSchema], default: [] },
    special_abilities: { type: [actionSchema], default: [] },
    document__title: { type: String, default: '' },
    document__slug: { type: String, default: '' },
    dataSource: { type: String, enum: ['wotc', 'third-party'], default: 'wotc' },
  },
  { timestamps: true },
)

MonsterSchema.index({ name: 'text' })
MonsterSchema.index({ name: 1 })
MonsterSchema.index({ cr: 1 })

export const Monster = model<IMonster>('Monster', MonsterSchema)
