import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ── mock the service layer so the store receives a Result we control ───────
vi.mock('@/services/notificationService', () => ({
  notificationService: {
    list: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    remove: vi.fn(),
  },
}))

import { useNotificationsStore } from './notifications'
import { notificationService, type AppNotification } from '@/services/notificationService'

// Fixture factory with sensible defaults + partial overrides.
function makeNotification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    _id: 'n1',
    userId: 'u1',
    type: 'system',
    title: 'Test',
    message: 'Body',
    read: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('useNotificationsStore.load', () => {
  it('should populate notifications on an ok result', async () => {
    // ── arrange ───────────────────────────────────────────────────────────
    const items = [makeNotification(), makeNotification({ _id: 'n2' })]
    vi.mocked(notificationService.list).mockResolvedValue({ type: 'ok', data: items })
    const store = useNotificationsStore()

    // ── act ───────────────────────────────────────────────────────────────
    await store.load()

    // ── assert ────────────────────────────────────────────────────────────
    expect(store.notifications).toEqual(items)
    expect(store.loading).toBe(false)
  })

  it('should leave notifications untouched on an error result', async () => {
    vi.mocked(notificationService.list).mockResolvedValue({ type: 'error', message: 'boom' })
    const store = useNotificationsStore()

    await store.load()

    expect(store.notifications).toEqual([])
    expect(store.loading).toBe(false)
  })
})

describe('useNotificationsStore.unreadCount', () => {
  it('should count only unread notifications', async () => {
    vi.mocked(notificationService.list).mockResolvedValue({
      type: 'ok',
      data: [
        makeNotification({ _id: 'a', read: false }),
        makeNotification({ _id: 'b', read: true }),
        makeNotification({ _id: 'c', read: false }),
      ],
    })
    const store = useNotificationsStore()
    await store.load()

    expect(store.unreadCount).toBe(2)
  })
})

describe('useNotificationsStore.markRead', () => {
  it('should mutate the matching notification in place on success', async () => {
    vi.mocked(notificationService.list).mockResolvedValue({
      type: 'ok',
      data: [makeNotification({ _id: 'a', read: false })],
    })
    vi.mocked(notificationService.markRead).mockResolvedValue({
      type: 'ok',
      data: makeNotification({ _id: 'a', read: true }),
    })
    const store = useNotificationsStore()
    await store.load()

    await store.markRead('a')

    expect(store.notifications[0].read).toBe(true)
  })

  it('should not mutate state when the service reports an error', async () => {
    vi.mocked(notificationService.list).mockResolvedValue({
      type: 'ok',
      data: [makeNotification({ _id: 'a', read: false })],
    })
    vi.mocked(notificationService.markRead).mockResolvedValue({ type: 'error', message: 'nope' })
    const store = useNotificationsStore()
    await store.load()

    await store.markRead('a')

    expect(store.notifications[0].read).toBe(false)
  })
})

describe('useNotificationsStore.remove', () => {
  it('should drop the notification from the list on success', async () => {
    vi.mocked(notificationService.list).mockResolvedValue({
      type: 'ok',
      data: [makeNotification({ _id: 'a' }), makeNotification({ _id: 'b' })],
    })
    vi.mocked(notificationService.remove).mockResolvedValue({ type: 'ok', data: undefined })
    const store = useNotificationsStore()
    await store.load()

    await store.remove('a')

    expect(store.notifications.map((n) => n._id)).toEqual(['b'])
  })
})
