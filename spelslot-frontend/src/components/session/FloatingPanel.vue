<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'

const props = defineProps<{
  id: string
  title: string
  icon: string
  x: number
  y: number
  width: number
  height: number
  minimized: boolean
  zIndex: number
}>()

const emit = defineEmits<{
  move: [x: number, y: number]
  resize: [w: number, h: number]
  moveAndResize: [x: number, y: number, w: number, h: number]
  minimize: []
  close: []
  focus: []
}>()

const HEADER_H = 36
const MIN_W = 240
const MIN_H = 100

// ── Drag ─────────────────────────────────────────────────────────────────

let dragActive = false
let dragStart = { mx: 0, my: 0, px: 0, py: 0 }

function startDrag(e: MouseEvent) {
  if (e.button !== 0) return
  dragActive = true
  dragStart = { mx: e.clientX, my: e.clientY, px: props.x, py: props.y }
  emit('focus')
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', stopDrag)
  e.preventDefault()
}

function onDragMove(e: MouseEvent) {
  if (!dragActive) return
  emit('move', dragStart.px + (e.clientX - dragStart.mx), dragStart.py + (e.clientY - dragStart.my))
}

function stopDrag() {
  dragActive = false
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', stopDrag)
}

// ── Resize ────────────────────────────────────────────────────────────────

let resizeActive = false
let resizeEdge = ''
let resStart = { mx: 0, my: 0, x: 0, y: 0, w: 0, h: 0 }

function startResize(e: MouseEvent, edge: string) {
  if (e.button !== 0) return
  resizeActive = true
  resizeEdge = edge
  resStart = { mx: e.clientX, my: e.clientY, x: props.x, y: props.y, w: props.width, h: props.height }
  emit('focus')
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', stopResize)
  e.preventDefault()
  e.stopPropagation()
}

function onResizeMove(e: MouseEvent) {
  if (!resizeActive) return
  const dx = e.clientX - resStart.mx
  const dy = e.clientY - resStart.my

  let x = resStart.x, y = resStart.y, w = resStart.w, h = resStart.h

  if (resizeEdge.includes('e')) w = Math.max(MIN_W, resStart.w + dx)
  if (resizeEdge.includes('s')) h = Math.max(MIN_H, resStart.h + dy)
  if (resizeEdge.includes('w')) {
    w = Math.max(MIN_W, resStart.w - dx)
    x = resStart.x + (resStart.w - w)
  }
  if (resizeEdge.includes('n')) {
    h = Math.max(MIN_H, resStart.h - dy)
    y = resStart.y + (resStart.h - h)
  }

  emit('moveAndResize', x, y, w, h)
}

function stopResize() {
  resizeActive = false
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', stopResize)
}

onBeforeUnmount(() => {
  stopDrag()
  stopResize()
})

const panelStyle = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`,
  width: `${props.width}px`,
  height: props.minimized ? `${HEADER_H}px` : `${props.height}px`,
  zIndex: props.zIndex,
}))
</script>

<template>
  <div
    class="fp"
    :class="{ 'fp--minimized': minimized }"
    :style="panelStyle"
    @mousedown="emit('focus')"
  >
    <!-- Header = drag handle -->
    <div class="fp__header" @mousedown.self="startDrag">
      <i :class="['pi', icon, 'fp__icon']" />
      <span class="fp__title" @mousedown="startDrag">{{ title }}</span>
      <div class="fp__controls">
        <button
          class="fp__ctrl"
          :title="minimized ? 'Restore' : 'Minimize'"
          @mousedown.stop
          @click="emit('minimize')"
        >
          <i :class="['pi', minimized ? 'pi-window-maximize' : 'pi-minus']" />
        </button>
        <button class="fp__ctrl fp__ctrl--close" title="Close panel" @mousedown.stop @click="emit('close')">
          <i class="pi pi-times" />
        </button>
      </div>
    </div>

    <!-- Content (hidden when minimized) -->
    <div v-if="!minimized" class="fp__content">
      <slot />
    </div>

    <!-- Resize handles (only when not minimized) -->
    <template v-if="!minimized">
      <div class="fp__resize fp__resize--n"  @mousedown.stop="startResize($event, 'n')" />
      <div class="fp__resize fp__resize--ne" @mousedown.stop="startResize($event, 'ne')" />
      <div class="fp__resize fp__resize--e"  @mousedown.stop="startResize($event, 'e')" />
      <div class="fp__resize fp__resize--se" @mousedown.stop="startResize($event, 'se')" />
      <div class="fp__resize fp__resize--s"  @mousedown.stop="startResize($event, 's')" />
      <div class="fp__resize fp__resize--sw" @mousedown.stop="startResize($event, 'sw')" />
      <div class="fp__resize fp__resize--w"  @mousedown.stop="startResize($event, 'w')" />
      <div class="fp__resize fp__resize--nw" @mousedown.stop="startResize($event, 'nw')" />
    </template>
  </div>
</template>

<style scoped>
.fp {
  position: fixed;
  display: flex;
  flex-direction: column;
  background: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  transition: box-shadow 0.15s;
}

.fp:hover {
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(0, 0, 0, 0.25);
}

/* ── Header ── */
.fp__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.5rem 0 0.75rem;
  height: 36px;
  background: var(--ss-shell);
  border-bottom: 1px solid var(--ss-primary);
  cursor: grab;
  flex-shrink: 0;
  user-select: none;
}

.fp__header:active {
  cursor: grabbing;
}

.fp--minimized .fp__header {
  border-bottom: none;
}

.fp__icon {
  font-size: 0.75rem;
  color: var(--ss-primary);
  pointer-events: none;
}

.fp__title {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ss-shell-fg);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: grab;
}

.fp__title:active {
  cursor: grabbing;
}

/* ── Control buttons ── */
.fp__controls {
  display: flex;
  align-items: center;
  gap: 1px;
  flex-shrink: 0;
}

.fp__ctrl {
  background: none;
  border: none;
  color: var(--ss-shell-fg-muted);
  cursor: pointer;
  padding: 3px 5px;
  border-radius: 3px;
  font-size: 0.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  transition: color 0.1s, background 0.1s;
}

.fp__ctrl:hover {
  color: var(--ss-shell-fg);
  background: color-mix(in srgb, var(--ss-shell-fg) 12%, transparent);
}

.fp__ctrl--close:hover {
  color: #f87171;
  background: color-mix(in srgb, #f87171 15%, transparent);
}

/* ── Content ── */
.fp__content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: var(--ss-border) transparent;
}

/* ── Resize handles ── */
.fp__resize {
  position: absolute;
  background: transparent;
  z-index: 10;
}

.fp__resize--n  { top: -4px;    left: 10px;   right: 10px;  height: 8px;  cursor: n-resize;  }
.fp__resize--s  { bottom: -4px; left: 10px;   right: 10px;  height: 8px;  cursor: s-resize;  }
.fp__resize--e  { right: -4px;  top: 10px;    bottom: 10px; width: 8px;   cursor: e-resize;  }
.fp__resize--w  { left: -4px;   top: 10px;    bottom: 10px; width: 8px;   cursor: w-resize;  }
.fp__resize--ne { top: -4px;    right: -4px;  width: 14px;  height: 14px; cursor: ne-resize; }
.fp__resize--nw { top: -4px;    left: -4px;   width: 14px;  height: 14px; cursor: nw-resize; }
.fp__resize--se { bottom: -4px; right: -4px;  width: 14px;  height: 14px; cursor: se-resize; }
.fp__resize--sw { bottom: -4px; left: -4px;   width: 14px;  height: 14px; cursor: sw-resize; }
</style>
