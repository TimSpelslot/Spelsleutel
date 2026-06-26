import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePanelLayout, PanelConfig } from './usePanelLayout'

function makePanelConfig(overrides?: Partial<PanelConfig>): PanelConfig {
  return {
    id: 'panel-1',
    title: 'Test Panel',
    icon: 'pi pi-box',
    defaultX: 100,
    defaultY: 50,
    defaultW: 300,
    defaultH: 200,
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    getPropertyValue: vi.fn().mockReturnValue(''),
  } as unknown as CSSStyleDeclaration)
})

describe('usePanelLayout initialisation', () => {
  it('should create default state for each panel', () => {
    // Arrange
    const panel = makePanelConfig()

    // Act
    const { states } = usePanelLayout([panel], 'test-key')

    // Assert
    expect(states.value['panel-1']).toBeDefined()
    expect(states.value['panel-1'].x).toBe(100)
    expect(states.value['panel-1'].y).toBe(50)
    expect(states.value['panel-1'].w).toBe(300)
    expect(states.value['panel-1'].h).toBe(200)
    expect(states.value['panel-1'].minimized).toBe(false)
    expect(states.value['panel-1'].closed).toBe(false)
  })

  it('should assign a zIndex for each panel on init', () => {
    // Arrange
    const panel = makePanelConfig()

    // Act
    const { states } = usePanelLayout([panel], 'test-key')

    // Assert
    expect(typeof states.value['panel-1'].zIndex).toBe('number')
    expect(states.value['panel-1'].zIndex).toBeGreaterThanOrEqual(100)
  })
})

describe('usePanelLayout persistence from localStorage', () => {
  it('should load saved state from localStorage', () => {
    // Arrange
    const savedState = {
      'panel-1': {
        x: 200,
        y: 150,
        w: 400,
        h: 250,
        minimized: true,
        closed: false,
        zIndex: 105,
      },
    }
    localStorage.setItem('test-key', JSON.stringify(savedState))
    const panel = makePanelConfig()

    // Act
    const { states } = usePanelLayout([panel], 'test-key')

    // Assert
    expect(states.value['panel-1'].x).toBe(200)
    expect(states.value['panel-1'].y).toBe(150)
    expect(states.value['panel-1'].minimized).toBe(true)
  })
})

describe('usePanelLayout focus', () => {
  it('should increment zIndex above the current topZ', () => {
    // Arrange
    const panel = makePanelConfig()
    const { states, focus } = usePanelLayout([panel], 'test-key')
    const initialZ = states.value['panel-1'].zIndex

    // Act
    focus('panel-1')

    // Assert
    expect(states.value['panel-1'].zIndex).toBeGreaterThan(initialZ)
  })
})

describe('usePanelLayout move', () => {
  it('should update x and y (clamped to >= 0 in jsdom)', () => {
    // Arrange
    const panel = makePanelConfig()
    const { states, move } = usePanelLayout([panel], 'test-key')

    // Act
    move('panel-1', 150, 80)

    // Assert
    expect(states.value['panel-1'].x).toBe(150)
    expect(states.value['panel-1'].y).toBe(80)
  })

  it('should clamp x and y to a minimum of 0', () => {
    // Arrange
    const panel = makePanelConfig()
    const { states, move } = usePanelLayout([panel], 'test-key')

    // Act
    move('panel-1', -50, -20)

    // Assert
    expect(states.value['panel-1'].x).toBe(0)
    expect(states.value['panel-1'].y).toBe(0)
  })
})

describe('usePanelLayout resize', () => {
  it('should update w and h', () => {
    // Arrange
    const panel = makePanelConfig()
    const { states, resize } = usePanelLayout([panel], 'test-key')

    // Act
    resize('panel-1', 500, 350)

    // Assert
    expect(states.value['panel-1'].w).toBe(500)
    expect(states.value['panel-1'].h).toBe(350)
  })
})

describe('usePanelLayout toggleMinimize', () => {
  it('should flip the minimized flag to true', () => {
    // Arrange
    const panel = makePanelConfig()
    const { states, toggleMinimize } = usePanelLayout([panel], 'test-key')

    // Act
    toggleMinimize('panel-1')

    // Assert
    expect(states.value['panel-1'].minimized).toBe(true)
  })

  it('should flip the minimized flag back to false when called again', () => {
    // Arrange
    const panel = makePanelConfig()
    const { states, toggleMinimize } = usePanelLayout([panel], 'test-key')

    // Act
    toggleMinimize('panel-1')
    toggleMinimize('panel-1')

    // Assert
    expect(states.value['panel-1'].minimized).toBe(false)
  })
})

describe('usePanelLayout close', () => {
  it('should set closed to true and move panel to closedPanels', () => {
    // Arrange
    const panel = makePanelConfig()
    const { states, close, closedPanels } = usePanelLayout([panel], 'test-key')

    // Act
    close('panel-1')

    // Assert
    expect(states.value['panel-1'].closed).toBe(true)
    expect(closedPanels.value).toContain(panel)
  })
})

describe('usePanelLayout open', () => {
  it('should set closed and minimized to false and move panel to visiblePanels', () => {
    // Arrange
    const panel = makePanelConfig()
    const { states, close, open, visiblePanels } = usePanelLayout([panel], 'test-key')
    close('panel-1')

    // Act
    open('panel-1')

    // Assert
    expect(states.value['panel-1'].closed).toBe(false)
    expect(states.value['panel-1'].minimized).toBe(false)
    expect(visiblePanels.value).toContain(panel)
  })
})

describe('usePanelLayout visiblePanels and closedPanels', () => {
  it('should return all panels in visiblePanels by default', () => {
    // Arrange
    const panelA = makePanelConfig({ id: 'a', title: 'A' })
    const panelB = makePanelConfig({ id: 'b', title: 'B' })

    // Act
    const { visiblePanels, closedPanels } = usePanelLayout([panelA, panelB], 'test-key')

    // Assert
    expect(visiblePanels.value).toHaveLength(2)
    expect(closedPanels.value).toHaveLength(0)
  })

  it('should move a panel from visible to closed after calling close', () => {
    // Arrange
    const panelA = makePanelConfig({ id: 'a', title: 'A' })
    const panelB = makePanelConfig({ id: 'b', title: 'B' })
    const { visiblePanels, closedPanels, close } = usePanelLayout([panelA, panelB], 'test-key')

    // Act
    close('a')

    // Assert
    expect(visiblePanels.value).toHaveLength(1)
    expect(closedPanels.value).toHaveLength(1)
    expect(closedPanels.value[0].id).toBe('a')
  })
})

describe('usePanelLayout save', () => {
  it('should write state to localStorage after move', () => {
    // Arrange
    const panel = makePanelConfig()
    const { move } = usePanelLayout([panel], 'test-key')

    // Act
    move('panel-1', 100, 100)

    // Assert
    const saved = JSON.parse(localStorage.getItem('test-key') ?? 'null')
    expect(saved).not.toBeNull()
    expect(saved['panel-1'].x).toBe(100)
  })

  it('should write state to localStorage after resize', () => {
    // Arrange
    const panel = makePanelConfig()
    const { resize } = usePanelLayout([panel], 'test-key')

    // Act
    resize('panel-1', 600, 400)

    // Assert
    const saved = JSON.parse(localStorage.getItem('test-key') ?? 'null')
    expect(saved['panel-1'].w).toBe(600)
    expect(saved['panel-1'].h).toBe(400)
  })

  it('should write state to localStorage after close', () => {
    // Arrange
    const panel = makePanelConfig()
    const { close } = usePanelLayout([panel], 'test-key')

    // Act
    close('panel-1')

    // Assert
    const saved = JSON.parse(localStorage.getItem('test-key') ?? 'null')
    expect(saved['panel-1'].closed).toBe(true)
  })
})
