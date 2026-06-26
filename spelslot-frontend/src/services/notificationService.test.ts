import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

import { notificationService } from './notificationService'
import type { AppNotification } from './notificationService'
import { api } from './api'

function makeAppNotification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    _id: 'notif-1',
    userId: 'user-1',
    type: 'system',
    title: 'Welcome',
    message: 'Welcome to Spelslot!',
    read: false,
    createdAt: '2026-06-25T00:00:00Z',
    updatedAt: '2026-06-25T00:00:00Z',
    ...overrides,
  }
}

const apiMock = api as {
  get: ReturnType<typeof vi.fn>
  patch: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('notificationService.list', () => {
  it('should unwrap { notifications } on ok', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    const notifications = [
      makeAppNotification(),
      makeAppNotification({ _id: 'notif-2', title: 'Session started' }),
    ]
    apiMock.get.mockResolvedValue({ type: 'ok', data: { notifications } })

    // ── act ──────────────────────────────────────────────────────────────────
    const result = await notificationService.list()

    // ── assert ────────────────────────────────────────────────────────────────
    expect(apiMock.get).toHaveBeenCalledWith('/api/notifications')
    expect(result.type).toBe('ok')
    if (result.type === 'ok') {
      expect(result.data).toHaveLength(2)
      expect(result.data[0]._id).toBe('notif-1')
    }
  })

  it('should pass through error from api', async () => {
    apiMock.get.mockResolvedValue({ type: 'error', message: 'Unauthorized' })

    const result = await notificationService.list()

    expect(result.type).toBe('error')
    if (result.type === 'error') {
      expect(result.message).toBe('Unauthorized')
    }
  })
})

describe('notificationService.markRead', () => {
  it('should unwrap { notification } on ok', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    const notification = makeAppNotification({ _id: 'notif-5', read: true })
    apiMock.patch.mockResolvedValue({ type: 'ok', data: { notification } })

    // ── act ──────────────────────────────────────────────────────────────────
    const result = await notificationService.markRead('notif-5')

    // ── assert ────────────────────────────────────────────────────────────────
    expect(apiMock.patch).toHaveBeenCalledWith('/api/notifications/notif-5/read', {})
    expect(result.type).toBe('ok')
    if (result.type === 'ok') {
      expect(result.data.read).toBe(true)
      expect(result.data._id).toBe('notif-5')
    }
  })

  it('should pass through error from api', async () => {
    apiMock.patch.mockResolvedValue({ type: 'error', message: 'Not found' })

    const result = await notificationService.markRead('missing')

    expect(result.type).toBe('error')
  })
})

describe('notificationService.markAllRead', () => {
  it('should return { type: ok, data: undefined } on success', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    apiMock.patch.mockResolvedValue({ type: 'ok', data: { success: true } })

    // ── act ──────────────────────────────────────────────────────────────────
    const result = await notificationService.markAllRead()

    // ── assert ────────────────────────────────────────────────────────────────
    expect(apiMock.patch).toHaveBeenCalledWith('/api/notifications/read-all', {})
    expect(result.type).toBe('ok')
    if (result.type === 'ok') {
      expect(result.data).toBeUndefined()
    }
  })

  it('should pass through error from api', async () => {
    apiMock.patch.mockResolvedValue({ type: 'error', message: 'Server error' })

    const result = await notificationService.markAllRead()

    expect(result.type).toBe('error')
  })
})

describe('notificationService.remove', () => {
  it('should return { type: ok, data: undefined } on success', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    apiMock.delete.mockResolvedValue({ type: 'ok', data: { success: true } })

    // ── act ──────────────────────────────────────────────────────────────────
    const result = await notificationService.remove('notif-3')

    // ── assert ────────────────────────────────────────────────────────────────
    expect(apiMock.delete).toHaveBeenCalledWith('/api/notifications/notif-3')
    expect(result.type).toBe('ok')
    if (result.type === 'ok') {
      expect(result.data).toBeUndefined()
    }
  })

  it('should pass through error from api', async () => {
    apiMock.delete.mockResolvedValue({ type: 'error', message: 'Not found' })

    const result = await notificationService.remove('missing')

    expect(result.type).toBe('error')
  })
})

describe('notificationService.updatePreferences', () => {
  it('should return { type: ok, data: undefined } on success', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    apiMock.patch.mockResolvedValue({ type: 'ok', data: {} })
    const prefs = { notifySignup: true, notifyAssignment: false }

    // ── act ──────────────────────────────────────────────────────────────────
    const result = await notificationService.updatePreferences(prefs)

    // ── assert ────────────────────────────────────────────────────────────────
    expect(apiMock.patch).toHaveBeenCalledWith('/api/auth/me/preferences', prefs)
    expect(result.type).toBe('ok')
    if (result.type === 'ok') {
      expect(result.data).toBeUndefined()
    }
  })

  it('should pass through error from api', async () => {
    apiMock.patch.mockResolvedValue({ type: 'error', message: 'Validation error' })

    const result = await notificationService.updatePreferences({})

    expect(result.type).toBe('error')
  })
})

describe('notificationService.registerFcmToken', () => {
  it('should return { type: ok, data: undefined } on success', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    apiMock.post.mockResolvedValue({ type: 'ok', data: { success: true } })

    // ── act ──────────────────────────────────────────────────────────────────
    const result = await notificationService.registerFcmToken('fcm-token-abc')

    // ── assert ────────────────────────────────────────────────────────────────
    expect(apiMock.post).toHaveBeenCalledWith('/api/notifications/fcm-token', {
      token: 'fcm-token-abc',
    })
    expect(result.type).toBe('ok')
    if (result.type === 'ok') {
      expect(result.data).toBeUndefined()
    }
  })

  it('should pass through error from api', async () => {
    apiMock.post.mockResolvedValue({ type: 'error', message: 'Bad token' })

    const result = await notificationService.registerFcmToken('bad')

    expect(result.type).toBe('error')
  })
})

describe('notificationService.unregisterFcmToken', () => {
  it('should return { type: ok, data: undefined } on success', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    apiMock.delete.mockResolvedValue({ type: 'ok', data: { success: true } })

    // ── act ──────────────────────────────────────────────────────────────────
    const result = await notificationService.unregisterFcmToken('fcm-token-abc')

    // ── assert ────────────────────────────────────────────────────────────────
    expect(apiMock.delete).toHaveBeenCalledWith('/api/notifications/fcm-token', {
      token: 'fcm-token-abc',
    })
    expect(result.type).toBe('ok')
    if (result.type === 'ok') {
      expect(result.data).toBeUndefined()
    }
  })

  it('should pass through error from api', async () => {
    apiMock.delete.mockResolvedValue({ type: 'error', message: 'Token not found' })

    const result = await notificationService.unregisterFcmToken('missing')

    expect(result.type).toBe('error')
  })
})
