import { describe, it, expect, vi, beforeEach } from 'vitest'

let isMobileView = false

beforeEach(() => {
  isMobileView = false
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: isMobileView,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
})

import { useSidebar } from './useSidebar'

describe('useSidebar toggle on desktop', () => {
  beforeEach(() => {
    // Reset module-level singleton state
    const sidebar = useSidebar()
    sidebar.closeMobile()
    if (sidebar.collapsed) sidebar.toggle()
  })

  it('should toggle collapsed and leave mobileOpen unchanged', () => {
    // Arrange
    isMobileView = false
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    )
    const sidebar = useSidebar()

    // Act
    sidebar.toggle()

    // Assert
    expect(sidebar.collapsed).toBe(true)
    expect(sidebar.mobileOpen).toBe(false)
  })
})

describe('useSidebar toggle on mobile', () => {
  beforeEach(() => {
    const sidebar = useSidebar()
    sidebar.closeMobile()
    if (sidebar.collapsed) {
      // reset collapsed using desktop toggle
      vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
      )
      sidebar.toggle()
    }
  })

  it('should toggle mobileOpen and leave collapsed unchanged', () => {
    // Arrange
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    )
    const sidebar = useSidebar()

    // Act
    sidebar.toggle()

    // Assert
    expect(sidebar.mobileOpen).toBe(true)
    expect(sidebar.collapsed).toBe(false)
  })
})

describe('useSidebar closeMobile', () => {
  it('should set mobileOpen to false', () => {
    // Arrange
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    )
    const sidebar = useSidebar()
    sidebar.toggle() // open mobile

    // Act
    sidebar.closeMobile()

    // Assert
    expect(sidebar.mobileOpen).toBe(false)
  })
})

describe('useSidebar toggle twice on desktop', () => {
  beforeEach(() => {
    const sidebar = useSidebar()
    sidebar.closeMobile()
    if (sidebar.collapsed) {
      vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
      )
      sidebar.toggle()
    }
  })

  it('should return to original collapsed state after two toggles', () => {
    // Arrange
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    )
    const sidebar = useSidebar()
    const initial = sidebar.collapsed

    // Act
    sidebar.toggle()
    sidebar.toggle()

    // Assert
    expect(sidebar.collapsed).toBe(initial)
  })
})
