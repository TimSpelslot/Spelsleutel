import { Schema, model, Types } from 'mongoose'

export type NotificationType = 'signup' | 'assignment' | 'marketplace' | 'session' | 'system'

export interface INotification {
  userId: Types.ObjectId
  type: NotificationType
  title: string
  message: string
  read: boolean
  href?: string
  createdAt: Date
  updatedAt: Date
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['signup', 'assignment', 'marketplace', 'session', 'system'],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    href: { type: String },
  },
  { timestamps: true },
)

export const Notification = model<INotification>('Notification', NotificationSchema)
