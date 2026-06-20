import { ref, computed } from 'vue'

function cssVar(name: string): number {
  return parseInt(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0
}

export interface PanelConfig {
  id: string
  title: string
  icon: string
  defaultX: number
  defaultY: number
  defaultW: number
  defaultH: number
}

export interface PanelState {
  x: number
  y: number
  w: number
  h: number
  minimized: boolean
  closed: boolean
  zIndex: number
}

export function usePanelLayout(panels: PanelConfig[], storageKey: string) {
  const topZ = ref(100)

  const states = ref<Record<string, PanelState>>(loadStates())

  function loadStates(): Record<string, PanelState> {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
      if (saved && typeof saved === 'object') return saved as Record<string, PanelState>
    } catch {}
    return {}
  }

  // Ensure every panel has a state entry (handles newly added panels after saved layout)
  for (const p of panels) {
    if (!states.value[p.id]) {
      states.value[p.id] = {
        x: p.defaultX,
        y: p.defaultY,
        w: p.defaultW,
        h: p.defaultH,
        minimized: false,
        closed: false,
        zIndex: topZ.value++,
      }
    } else {
      // Sync topZ so future focus() increments above saved values
      if (states.value[p.id].zIndex >= topZ.value) {
        topZ.value = states.value[p.id].zIndex + 1
      }
    }
  }

  function save() {
    localStorage.setItem(storageKey, JSON.stringify(states.value))
  }

  function focus(id: string) {
    states.value[id].zIndex = ++topZ.value
  }

  function clampX(x: number): number {
    // Check if sidebar is collapsed (its actual rendered width changes)
    const sidebar = document.querySelector('.sidebar') as HTMLElement | null
    const minX = sidebar ? sidebar.offsetWidth : cssVar('--ss-sidebar-width')
    return Math.max(minX, x)
  }

  function clampY(y: number): number {
    const minY = cssVar('--ss-navbar-height')
    return Math.max(minY, y)
  }

  function move(id: string, x: number, y: number) {
    const s = states.value[id]
    s.x = clampX(x)
    s.y = clampY(y)
    save()
  }

  function resize(id: string, w: number, h: number) {
    states.value[id].w = w
    states.value[id].h = h
    save()
  }

  function moveAndResize(id: string, x: number, y: number, w: number, h: number) {
    const s = states.value[id]
    s.x = clampX(x)
    s.y = clampY(y)
    s.w = w
    s.h = h
    save()
  }

  function toggleMinimize(id: string) {
    states.value[id].minimized = !states.value[id].minimized
    save()
  }

  function close(id: string) {
    states.value[id].closed = true
    save()
  }

  function open(id: string) {
    const s = states.value[id]
    s.closed = false
    s.minimized = false
    s.zIndex = ++topZ.value
    save()
  }

  const visiblePanels = computed(() => panels.filter((p) => !states.value[p.id]?.closed))
  const closedPanels = computed(() => panels.filter((p) => !!states.value[p.id]?.closed))

  return {
    states,
    visiblePanels,
    closedPanels,
    focus,
    move,
    resize,
    moveAndResize,
    toggleMinimize,
    close,
    open,
  }
}
