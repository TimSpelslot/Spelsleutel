import { describe, it, expect, vi, beforeEach } from 'vitest'

const addEventListenerMock = vi.fn()
const mediaQueryMock = {
  matches: false,
  addEventListener: addEventListenerMock,
  removeEventListener: vi.fn(),
}
vi.stubGlobal(
  'matchMedia',
  vi.fn(() => mediaQueryMock),
)

import { useColorScheme, initColorScheme } from './useColorScheme'

describe('useColorScheme setScheme', () => {
  beforeEach(() => {
    localStorage.clear()
    useColorScheme().setScheme('light')
    document.documentElement.classList.remove('ss-dark')
  })

  it('should add ss-dark class to documentElement when setScheme is dark', () => {
    // Arrange
    const cs = useColorScheme()

    // Act
    cs.setScheme('dark')

    // Assert
    expect(document.documentElement.classList.contains('ss-dark')).toBe(true)
  })

  it('should remove ss-dark class from documentElement when setScheme is light', () => {
    // Arrange
    const cs = useColorScheme()
    cs.setScheme('dark')

    // Act
    cs.setScheme('light')

    // Assert
    expect(document.documentElement.classList.contains('ss-dark')).toBe(false)
  })

  it('should persist dark to localStorage when setScheme is dark', () => {
    // Arrange
    const cs = useColorScheme()

    // Act
    cs.setScheme('dark')

    // Assert
    expect(localStorage.getItem('ss-color-scheme')).toBe('dark')
  })
})

describe('useColorScheme toggle', () => {
  beforeEach(() => {
    localStorage.clear()
    useColorScheme().setScheme('light')
    document.documentElement.classList.remove('ss-dark')
  })

  it('should add ss-dark class when toggling from light', () => {
    // Arrange
    const cs = useColorScheme()

    // Act
    cs.toggle()

    // Assert
    expect(document.documentElement.classList.contains('ss-dark')).toBe(true)
  })

  it('should return to light when toggling twice', () => {
    // Arrange
    const cs = useColorScheme()

    // Act
    cs.toggle()
    cs.toggle()

    // Assert
    expect(document.documentElement.classList.contains('ss-dark')).toBe(false)
    expect(cs.scheme).toBe('light')
  })
})

describe('useColorScheme scheme computed', () => {
  beforeEach(() => {
    localStorage.clear()
    useColorScheme().setScheme('light')
  })

  it('should return dark when isDark is true', () => {
    // Arrange
    const cs = useColorScheme()
    cs.setScheme('dark')

    // Assert
    expect(cs.scheme).toBe('dark')
  })

  it('should return light when isDark is false', () => {
    // Arrange
    const cs = useColorScheme()
    cs.setScheme('light')

    // Assert
    expect(cs.scheme).toBe('light')
  })
})

describe('initColorScheme', () => {
  beforeEach(() => {
    // 1. Use setScheme to reset the isDark singleton (this writes 'light' to localStorage)
    useColorScheme().setScheme('light')
    // 2. Remove the ss-dark class in case a previous test left it
    document.documentElement.classList.remove('ss-dark')
    // 3. NOW clear localStorage so initColorScheme sees storedChoice() === null
    localStorage.clear()
    mediaQueryMock.matches = false
    addEventListenerMock.mockClear()
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => mediaQueryMock),
    )
  })

  it('should apply dark when no localStorage and system prefers dark', () => {
    // Arrange — create a fresh mock object with matches: true so the stub
    // closure captures it correctly (avoids stale-closure issues with the
    // module-level mediaQueryMock object that beforeEach sets to false first)
    const darkMq = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => darkMq),
    )

    // Act
    initColorScheme()

    // Assert
    expect(document.documentElement.classList.contains('ss-dark')).toBe(true)
  })

  it('should apply light when localStorage is light and system prefers dark', () => {
    // Arrange
    localStorage.setItem('ss-color-scheme', 'light')
    mediaQueryMock.matches = true
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => mediaQueryMock),
    )

    // Act
    initColorScheme()

    // Assert
    expect(document.documentElement.classList.contains('ss-dark')).toBe(false)
  })

  it('should apply dark when localStorage is set to dark', () => {
    // Arrange
    localStorage.setItem('ss-color-scheme', 'dark')
    mediaQueryMock.matches = false
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => mediaQueryMock),
    )

    // Act
    initColorScheme()

    // Assert
    expect(document.documentElement.classList.contains('ss-dark')).toBe(true)
  })
})
