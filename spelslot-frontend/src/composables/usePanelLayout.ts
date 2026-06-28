import { ref, computed } from 'vue'

function cssVar(name: string): number {
  return parseInt(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0
}

export interface PanelType {
  type: string
  title: string
  icon: string
  defaultX: number
  defaultY: number
  defaultW: number
  defaultH: number
  /** false = can spawn multiple instances; omit or true = singleton */
  singleton?: boolean
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

export interface PanelInstance {
  id: string    // type name for singletons; `${type}-${timestamp}` for multi
  type: string
  title: string
  icon: string
  state: PanelState
}

export function usePanelLayout(catalog: PanelType[], storageKey: string) {
  const topZ = ref(100)
  const instances = ref<PanelInstance[]>([])

  // ── Load & migrate from localStorage ─────────────────────────────────────

  function loadInstances(): PanelInstance[] {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return []
      const parsed: unknown = JSON.parse(raw)

      // New format: array of PanelInstance
      if (Array.isArray(parsed)) {
        const validTypes = new Map(catalog.map((c) => [c.type, c]))
        return (parsed as PanelInstance[])
          .filter((i) => i?.id && validTypes.has(i.type))
          .map((i) => ({ ...i, icon: i.icon ?? validTypes.get(i.type)!.icon }))
      }

      // Legacy format: Record<id, PanelState> — migrate once
      if (parsed && typeof parsed === 'object') {
        const legacy = parsed as Record<string, PanelState>
        return Object.entries(legacy)
          .map(([id, state]) => {
            const pt = catalog.find((c) => c.type === id)
            if (!pt) return null
            return { id, type: id, title: pt.title, icon: pt.icon, state } as PanelInstance
          })
          .filter((i): i is PanelInstance => i !== null)
      }
    } catch {}
    return []
  }

  instances.value = loadInstances()

  // Seed singleton panels that aren't in saved state yet
  const existingTypes = new Set(instances.value.map((i) => i.type))
  for (const pt of catalog) {
    if (pt.singleton === false) continue
    if (!existingTypes.has(pt.type)) {
      instances.value.push({
        id: pt.type,
        type: pt.type,
        title: pt.title,
        icon: pt.icon,
        state: {
          x: pt.defaultX,
          y: pt.defaultY,
          w: pt.defaultW,
          h: pt.defaultH,
          minimized: false,
          closed: false,
          zIndex: topZ.value++,
        },
      })
    }
  }

  // Sync topZ above any saved value
  for (const inst of instances.value) {
    if (inst.state.zIndex >= topZ.value) topZ.value = inst.state.zIndex + 1
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  function save() {
    localStorage.setItem(storageKey, JSON.stringify(instances.value))
  }

  // ── Clamping ──────────────────────────────────────────────────────────────

  function clampX(x: number): number {
    const sidebar = document.querySelector('.sidebar') as HTMLElement | null
    const minX = sidebar ? sidebar.offsetWidth : cssVar('--ss-sidebar-width')
    return Math.max(minX, x)
  }

  function clampY(y: number): number {
    return Math.max(cssVar('--ss-navbar-height'), y)
  }

  // ── Panel operations ──────────────────────────────────────────────────────

  function focus(id: string) {
    const inst = instances.value.find((i) => i.id === id)
    if (inst) {
      inst.state.zIndex = ++topZ.value
      save()
    }
  }

  function move(id: string, x: number, y: number) {
    const inst = instances.value.find((i) => i.id === id)
    if (!inst) return
    inst.state.x = clampX(x)
    inst.state.y = clampY(y)
    save()
  }

  function resize(id: string, w: number, h: number) {
    const inst = instances.value.find((i) => i.id === id)
    if (inst) {
      inst.state.w = w
      inst.state.h = h
      save()
    }
  }

  function moveAndResize(id: string, x: number, y: number, w: number, h: number) {
    const inst = instances.value.find((i) => i.id === id)
    if (!inst) return
    inst.state.x = clampX(x)
    inst.state.y = clampY(y)
    inst.state.w = w
    inst.state.h = h
    save()
  }

  function toggleMinimize(id: string) {
    const inst = instances.value.find((i) => i.id === id)
    if (inst) {
      inst.state.minimized = !inst.state.minimized
      save()
    }
  }

  function close(id: string) {
    const inst = instances.value.find((i) => i.id === id)
    if (inst) {
      inst.state.closed = true
      save()
    }
  }

  function open(id: string) {
    const inst = instances.value.find((i) => i.id === id)
    if (inst) {
      inst.state.closed = false
      inst.state.minimized = false
      inst.state.zIndex = ++topZ.value
      save()
    }
  }

  /**
   * Spawn a new panel from the catalog.
   * Singletons: reopens the existing instance (or creates it if missing).
   * Multi-instance: always creates a new instance.
   */
  function spawn(type: string): string | null {
    const pt = catalog.find((c) => c.type === type)
    if (!pt) return null

    if (pt.singleton !== false) {
      const existing = instances.value.find((i) => i.type === type)
      if (existing) {
        open(existing.id)
        return existing.id
      }
      // Create singleton instance
      const inst: PanelInstance = {
        id: type,
        type,
        title: pt.title,
        icon: pt.icon,
        state: {
          x: pt.defaultX,
          y: pt.defaultY,
          w: pt.defaultW,
          h: pt.defaultH,
          minimized: false,
          closed: false,
          zIndex: ++topZ.value,
        },
      }
      instances.value.push(inst)
      save()
      return inst.id
    }

    // Multi-instance: create new with slight random offset so stacked panels are visible
    const offset = (instances.value.filter((i) => i.type === type).length % 5) * 24
    const id = `${type}-${Date.now()}`
    const inst: PanelInstance = {
      id,
      type,
      title: pt.title,
      icon: pt.icon,
      state: {
        x: clampX(pt.defaultX + offset),
        y: clampY(pt.defaultY + offset),
        w: pt.defaultW,
        h: pt.defaultH,
        minimized: false,
        closed: false,
        zIndex: ++topZ.value,
      },
    }
    instances.value.push(inst)
    save()
    return id
  }

  /** Remove a multi-instance panel entirely (not available for singletons). */
  function remove(id: string) {
    const inst = instances.value.find((i) => i.id === id)
    if (!inst) return
    const pt = catalog.find((c) => c.type === inst.type)
    if (!pt || pt.singleton !== false) return
    instances.value = instances.value.filter((i) => i.id !== id)
    save()
  }

  // ── Computed views ────────────────────────────────────────────────────────

  const visiblePanels = computed(() => instances.value.filter((i) => !i.state.closed))
  const closedPanels = computed(() => instances.value.filter((i) => !!i.state.closed))

  /** Non-singleton types available to spawn (always show in launcher Add section). */
  const spawnableTypes = computed(() => catalog.filter((c) => c.singleton === false))

  return {
    instances,
    visiblePanels,
    closedPanels,
    spawnableTypes,
    focus,
    move,
    resize,
    moveAndResize,
    toggleMinimize,
    close,
    open,
    spawn,
    remove,
  }
}
