import { Schema, Types, model } from 'mongoose'

export type SignUpStatus = 'pending' | 'assigned' | 'waitlist' | 'cancelled'

export interface ISignUp {
  sessionId: Types.ObjectId
  userId: Types.ObjectId
  status: SignUpStatus
  priority: number
  appeared: boolean
  createdAt: Date
  updatedAt: Date
}

const SignUpSchema = new Schema<ISignUp>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'assigned', 'waitlist', 'cancelled'],
      default: 'pending',
    },
    priority: { type: Number, default: 0 },
    appeared: { type: Boolean, default: false },
  },
  { timestamps: true },
)

SignUpSchema.index({ sessionId: 1, userId: 1 }, { unique: true })
SignUpSchema.index({ userId: 1, status: 1 })
SignUpSchema.index({ sessionId: 1, status: 1 })

export const SignUp = model<ISignUp>('SignUp', SignUpSchema)
