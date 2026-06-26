import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/firebase', () => ({
  getFirebaseMessaging: vi.fn().mockResolvedValue(null),
}))

vi.mock('firebase/messaging', () => ({
  getToken: vi.fn(),
  onMessage: vi.fn(),
}))

vi.mock('@/services/notificationService', () => ({
  notificationService: {
    registerFcmToken: vi.fn(),
    unregisterFcmToken: vi.fn(),
  },
}))

vi.mock('@/stores/notifications', () => ({
  useNotificationsStore: vi.fn().mockReturnValue({ load: vi.fn() }),
}))

import { notificationService } from '@/services/notificationService'
import { useFcm } from './useFcm'

beforeEach(() => {
  Object.defineProperty(window, 'Notification', {
    writable: true,
    value: {
      permission: 'default' as NotificationPermission,
      requestPermission: vi.fn().mockResolvedValue('default' as NotificationPermission),
    },
  })
  // serviceWorker is intentionally not stubbed so register() short-circuits
})

describe('useFcm initIfAlreadyGranted when permission is granted', () => {
  it('should call register without throwing when permission is granted', async () => {
    // Arrange
    Object.defineProperty(window, 'Notification', {
      writable: true,
      value: { permission: 'granted', requestPermission: vi.fn() },
    })
    const { initIfAlreadyGranted } = useFcm()

    // Act & Assert (register short-circuits due to no serviceWorker but must not throw)
    await expect(initIfAlreadyGranted()).resolves.toBeUndefined()
  })
})

describe('useFcm initIfAlreadyGranted when permission is not granted', () => {
  it('should resolve without error when permission is default', async () => {
    // Arrange
    Object.defineProperty(window, 'Notification', {
      writable: true,
      value: { permission: 'default', requestPermission: vi.fn() },
    })
    const { initIfAlreadyGranted } = useFcm()

    // Act & Assert
    await expect(initIfAlreadyGranted()).resolves.toBeUndefined()
  })

  it('should resolve without error when permission is denied', async () => {
    // Arrange
    Object.defineProperty(window, 'Notification', {
      writable: true,
      value: { permission: 'denied', requestPermission: vi.fn() },
    })
    const { initIfAlreadyGranted } = useFcm()

    // Act & Assert
    await expect(initIfAlreadyGranted()).resolves.toBeUndefined()
  })
})

describe('useFcm requestAndInit when permission is denied', () => {
  it('should return denied immediately without calling requestPermission', async () => {
    // Arrange
    const requestPermission = vi.fn()
    Object.defineProperty(window, 'Notification', {
      writable: true,
      value: { permission: 'denied', requestPermission },
    })
    const { requestAndInit } = useFcm()

    // Act
    const result = await requestAndInit()

    // Assert
    expect(result).toBe('denied')
    expect(requestPermission).not.toHaveBeenCalled()
  })
})

describe('useFcm requestAndInit when permission is default', () => {
  it('should call requestPermission and return its result', async () => {
    // Arrange
    const requestPermission = vi.fn().mockResolvedValue('granted')
    Object.defineProperty(window, 'Notification', {
      writable: true,
      value: { permission: 'default', requestPermission },
    })
    const { requestAndInit } = useFcm()

    // Act
    const result = await requestAndInit()

    // Assert
    expect(requestPermission).toHaveBeenCalled()
    expect(result).toBe('granted')
  })

  it('should return denied when requestPermission returns denied', async () => {
    // Arrange
    const requestPermission = vi.fn().mockResolvedValue('denied')
    Object.defineProperty(window, 'Notification', {
      writable: true,
      value: { permission: 'default', requestPermission },
    })
    const { requestAndInit } = useFcm()

    // Act
    const result = await requestAndInit()

    // Assert
    expect(result).toBe('denied')
  })
})

describe('useFcm requestAndInit when permission is granted', () => {
  it('should call register (short-circuits) and return granted', async () => {
    // Arrange
    Object.defineProperty(window, 'Notification', {
      writable: true,
      value: { permission: 'granted', requestPermission: vi.fn() },
    })
    const { requestAndInit } = useFcm()

    // Act
    const result = await requestAndInit()

    // Assert
    expect(result).toBe('granted')
  })
})

describe('useFcm cleanup with token', () => {
  it('should call unregisterFcmToken with the provided token', async () => {
    // Arrange
    const { cleanup } = useFcm()

    // Act
    await cleanup('test-token-123')

    // Assert
    expect(notificationService.unregisterFcmToken).toHaveBeenCalledWith('test-token-123')
  })
})

describe('useFcm cleanup without token', () => {
  it('should not call unregisterFcmToken when no token is provided', async () => {
    // Arrange
    const { cleanup } = useFcm()

    // Act
    await cleanup(undefined)

    // Assert
    expect(notificationService.unregisterFcmToken).not.toHaveBeenCalled()
  })

  it('should not call unregisterFcmToken when token is empty string', async () => {
    // Arrange
    const { cleanup } = useFcm()

    // Act
    await cleanup('')

    // Assert
    expect(notificationService.unregisterFcmToken).not.toHaveBeenCalled()
  })
})
