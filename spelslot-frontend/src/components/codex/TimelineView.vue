<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import {
  avgMinutesPerYear,
  minutesToLabel,
  minutesToYearNumber,
  yearStartMinutes,
  type LkCalendarDef,
} from '@/utils/lkCalendar'
import { codexService } from '@/services/codexService'

// ── Types ─────────────────────────────────────────────────────────────────

interface LkLane {
  id: string
  name: string
  pos: string
  size?: 'sm' | 'lg'
}

interface LkEvent {
  id: string
  laneId: string
  pos: string
  layer?: number
  start: number
  end: number
  name: string
  color: string
  opacity?: number
  uri?: string
  slug?: string
}

interface RenderEvent extends LkEvent {
  renderLayer: number
}

interface RenderLane extends LkLane {
  events: RenderEvent[]
  minLayer: number
  maxLayer: number
  height: number
}

interface Tick {
  x: number
  label: string
  major: boolean
}

// ── Props / emits ──────────────────────────────────────────────────────────

const props = defineProps<{
  content: { lanes?: LkLane[]; events?: LkEvent[] }
  calendarId: string | null
}>()

const emit = defineEmits<{ navigate: [slug: string] }>()

// ── State ──────────────────────────────────────────────────────────────────

const zoom = ref(50)
const scrollLeft = ref(0)
const containerW = ref(900)
const calendar = ref<LkCalendarDef | null>(null)
const calLoading = ref(false)
const canvasRef = ref<HTMLElement | null>(null)

// ── Zoom math ──────────────────────────────────────────────────────────────

// pxPerMin range: 10^-6 to 10^-3  (covers 800-year span down to 1-day views)
const LOG_MIN = Math.log10(1e-6)
const LOG_MAX = Math.log10(1e-3)

const pxPerMin = computed(() => {
  const t = zoom.value / 100
  return Math.pow(10, LOG_MIN + t * (LOG_MAX - LOG_MIN))
})

// ── Source data ────────────────────────────────────────────────────────────

const rawLanes = computed((): LkLane[] =>
  [...(props.content.lanes ?? [])].sort((a, b) => (a.pos < b.pos ? -1 : a.pos > b.pos ? 1 : 0)),
)

const rawEvents = computed((): LkEvent[] => props.content.events ?? [])

const minTime = computed(() => {
  if (!rawEvents.value.length) return 0
  return Math.min(...rawEvents.value.map((e) => e.start))
})

const maxTime = computed(() => {
  if (!rawEvents.value.length) return 1
  return Math.max(...rawEvents.value.map((e) => e.end))
})

const totalW = computed(() =>
  Math.max(containerW.value, (maxTime.value - minTime.value) * pxPerMin.value + 80),
)

// ── Lane render data ───────────────────────────────────────────────────────

const EVENT_H = 28
const LANE_PAD = 6

const renderLanes = computed((): RenderLane[] => {
  const byLane = new Map<string, LkEvent[]>()
  for (const ev of rawEvents.value) {
    const arr = byLane.get(ev.laneId) ?? []
    arr.push(ev)
    byLane.set(ev.laneId, arr)
  }

  return rawLanes.value.map((lane) => {
    const laneEvs = byLane.get(lane.id) ?? []
    const sorted = [...laneEvs].sort((a, b) => (a.pos < b.pos ? -1 : a.pos > b.pos ? 1 : 0))

    // Use layer values if any event has a non-zero layer; otherwise stack by pos order
    const hasExplicitLayers = sorted.some((e) => typeof e.layer === 'number' && e.layer !== 0)
    const renderEvents: RenderEvent[] = sorted.map((e, i) => ({
      ...e,
      renderLayer: hasExplicitLayers ? (e.layer ?? 0) : i,
    }))

    const layers = renderEvents.map((e) => e.renderLayer)
    const minLayer = layers.length ? Math.min(...layers) : 0
    const maxLayer = layers.length ? Math.max(...layers) : 0
    const height = Math.max(
      EVENT_H + LANE_PAD * 2,
      (maxLayer - minLayer + 1) * EVENT_H + LANE_PAD * 2,
    )

    return { ...lane, events: renderEvents, minLayer, maxLayer, height }
  })
})

// ── Ruler ticks ────────────────────────────────────────────────────────────

const RULER_H = 32

const visibleTicks = computed((): Tick[] => {
  const cal = calendar.value
  if (!cal) return []

  const mpy = avgMinutesPerYear(cal)
  const viewStart = minTime.value + scrollLeft.value / pxPerMin.value
  const viewEnd = viewStart + containerW.value / pxPerMin.value
  const visibleYears = Math.abs((viewEnd - viewStart) / mpy)

  let tickEvery: number
  let majorEvery: number

  if (visibleYears > 800) {
    tickEvery = 200
    majorEvery = 1000
  } else if (visibleYears > 300) {
    tickEvery = 100
    majorEvery = 500
  } else if (visibleYears > 100) {
    tickEvery = 50
    majorEvery = 100
  } else if (visibleYears > 40) {
    tickEvery = 10
    majorEvery = 50
  } else if (visibleYears > 15) {
    tickEvery = 5
    majorEvery = 25
  } else if (visibleYears > 5) {
    tickEvery = 2
    majorEvery = 10
  } else {
    tickEvery = 1
    majorEvery = 5
  }

  const startYear = minutesToYearNumber(viewStart, cal)
  const endYear = minutesToYearNumber(viewEnd, cal) + tickEvery
  const firstTick = Math.floor(startYear / tickEvery) * tickEvery

  const ticks: Tick[] = []
  for (let y = firstTick; y <= endYear; y += tickEvery) {
    const tickMin = yearStartMinutes(y, cal)
    const x = (tickMin - minTime.value) * pxPerMin.value
    if (x < -100 || x > totalW.value + 100) continue
    ticks.push({
      x,
      label: minutesToLabel(tickMin, cal, 'year'),
      major: y % majorEvery === 0,
    })
  }
  return ticks
})

// ── Event styling ──────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '').padEnd(6, '0')
  const r = parseInt(clean.slice(0, 2), 16) || 100
  const g = parseInt(clean.slice(2, 4), 16) || 100
  const b = parseInt(clean.slice(4, 6), 16) || 100
  return `rgba(${r},${g},${b},${alpha})`
}

function eventStyle(ev: RenderEvent, lane: RenderLane): Record<string, string> {
  const top = LANE_PAD + (ev.renderLayer - lane.minLayer) * EVENT_H
  const left = (ev.start - minTime.value) * pxPerMin.value
  const width = Math.max(4, (ev.end - ev.start) * pxPerMin.value)
  const alpha = ev.opacity ?? 1
  return {
    top: `${top}px`,
    left: `${left}px`,
    width: `${width}px`,
    height: `${EVENT_H - 4}px`,
    background: hexToRgba(ev.color ?? '#666666', alpha),
    borderColor: hexToRgba(ev.color ?? '#666666', Math.min(1, alpha + 0.3)),
  }
}

function eventTitle(ev: LkEvent): string {
  const cal = calendar.value
  if (!cal) return ev.name
  const s = minutesToLabel(ev.start, cal, 'day')
  const e = minutesToLabel(ev.end, cal, 'day')
  return `${ev.name}\n${s} – ${e}`
}

// ── Zoom / fit ─────────────────────────────────────────────────────────────

function fitToView() {
  const span = maxTime.value - minTime.value
  if (span <= 0 || containerW.value <= 0) return
  const target = (containerW.value - 40) / span
  const clamped = Math.max(Math.pow(10, LOG_MIN), Math.min(Math.pow(10, LOG_MAX), target))
  zoom.value = Math.round((100 * (Math.log10(clamped) - LOG_MIN)) / (LOG_MAX - LOG_MIN))
  nextTick(() => {
    if (canvasRef.value) canvasRef.value.scrollLeft = 0
    scrollLeft.value = 0
  })
}

// ── Calendar loading ───────────────────────────────────────────────────────

async function loadCalendar(id: string) {
  calLoading.value = true
  const result = await codexService.getCalendar(id)
  calLoading.value = false
  if (result.type === 'ok') {
    calendar.value = result.data
    nextTick(() => fitToView())
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

let resizeObs: ResizeObserver | null = null

onMounted(() => {
  if (props.calendarId) loadCalendar(props.calendarId)

  if (canvasRef.value) {
    resizeObs = new ResizeObserver(([entry]) => {
      containerW.value = entry.contentRect.width
      if (!props.calendarId) fitToView()
    })
    resizeObs.observe(canvasRef.value)
    nextTick(() => {
      if (!props.calendarId) fitToView()
    })
  }
})

onUnmounted(() => resizeObs?.disconnect())

function onCanvasScroll(e: Event) {
  scrollLeft.value = (e.target as HTMLElement).scrollLeft
}

function onEventClick(ev: LkEvent) {
  if (ev.slug) emit('navigate', ev.slug)
}

const zoomLabel = computed(() => {
  const cal = calendar.value
  if (!cal) return ''
  const mpy = avgMinutesPerYear(cal)
  const minutesPerPx = 1 / pxPerMin.value
  const yearsPerPx = minutesPerPx / mpy
  if (yearsPerPx >= 10) return `${Math.round(yearsPerPx)} yr/px`
  if (yearsPerPx >= 1) return `${yearsPerPx.toFixed(1)} yr/px`
  const daysPerPx = minutesPerPx / (cal.minutesInHour * cal.hoursInDay)
  if (daysPerPx >= 1) return `${daysPerPx.toFixed(1)} day/px`
  return `< 1 day/px`
})
</script>

<template>
  <div class="tl">
    <!-- Controls bar -->
    <div class="tl__controls">
      <label class="tl__zoom-label">
        <i class="pi pi-search-minus tl__zoom-icon" />
        <input
          v-model.number="zoom"
          type="range"
          min="0"
          max="100"
          class="tl__zoom-slider"
          :title="$t('codex.timeline.zoomTitle')"
        />
        <i class="pi pi-search-plus tl__zoom-icon" />
      </label>
      <span class="tl__zoom-value">{{ zoomLabel }}</span>
      <button class="tl__fit-btn" :title="$t('codex.timeline.fitTitle')" @click="fitToView">
        <i class="pi pi-arrows-h" /> {{ $t('codex.timeline.fitLabel') }}
      </button>
      <span v-if="calLoading" class="tl__cal-loading">
        <i class="pi pi-spin pi-spinner" /> {{ $t('codex.timeline.loadingCalendar') }}
      </span>
      <span v-else-if="!calendar && calendarId" class="tl__cal-missing">
        <i class="pi pi-exclamation-triangle" /> {{ $t('codex.timeline.calendarNotFound') }}
      </span>
    </div>

    <!-- Empty state -->
    <div v-if="!rawEvents.length" class="tl__empty">
      <i class="pi pi-clock" />
      {{ $t('codex.timeline.noEvents') }}
    </div>

    <!-- Body -->
    <div v-else class="tl__body">
      <!-- Lane labels (fixed left column) -->
      <div class="tl__labels">
        <div class="tl__ruler-spacer" :style="{ height: RULER_H + 'px' }" />
        <div
          v-for="lane in renderLanes"
          :key="lane.id"
          class="tl__label"
          :style="{ height: lane.height + 'px' }"
        >
          {{ lane.name || '—' }}
        </div>
      </div>

      <!-- Scrollable timeline canvas -->
      <div ref="canvasRef" class="tl__canvas" @scroll="onCanvasScroll">
        <div class="tl__inner" :style="{ width: totalW + 'px' }">
          <!-- Ruler -->
          <div class="tl__ruler" :style="{ height: RULER_H + 'px' }">
            <div
              v-for="tick in visibleTicks"
              :key="tick.x"
              class="tl__tick"
              :style="{ left: tick.x + 'px' }"
            >
              <div class="tl__tick-line" :class="{ 'tl__tick-line--major': tick.major }" />
              <span class="tl__tick-label" :class="{ 'tl__tick-label--major': tick.major }">
                {{ tick.label }}
              </span>
            </div>
          </div>

          <!-- Lane rows -->
          <div
            v-for="lane in renderLanes"
            :key="lane.id"
            class="tl__lane"
            :style="{ height: lane.height + 'px' }"
          >
            <div
              v-for="ev in lane.events"
              :key="ev.id"
              class="tl__event"
              :class="{ 'tl__event--link': !!ev.slug }"
              :style="eventStyle(ev, lane)"
              :title="eventTitle(ev)"
              @click="onEventClick(ev)"
            >
              <span class="tl__event-label">{{ ev.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tl {
  display: flex;
  flex-direction: column;
  background: var(--ss-surface);
  font-size: 0.8rem;
  border-radius: 0 0 var(--ss-radius) var(--ss-radius);
}

/* Controls */
.tl__controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem 0.75rem;
  background: var(--ss-parchment-dark);
  border-bottom: 1px solid var(--ss-border);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.tl__zoom-label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.tl__zoom-icon {
  font-size: 0.65rem;
  color: var(--ss-text-muted);
}

.tl__zoom-slider {
  width: 120px;
  accent-color: var(--ss-primary);
  cursor: pointer;
}

.tl__zoom-value {
  font-size: 0.68rem;
  color: var(--ss-text-muted);
  min-width: 4rem;
}

.tl__fit-btn {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  background: none;
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  padding: 0.2rem 0.5rem;
  font-size: 0.72rem;
  color: var(--ss-text-muted);
  cursor: pointer;
  transition:
    color 0.12s,
    border-color 0.12s;
}
.tl__fit-btn:hover {
  color: var(--ss-primary);
  border-color: var(--ss-primary);
}
.tl__fit-btn .pi {
  font-size: 0.65rem;
}

.tl__cal-loading,
.tl__cal-missing {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.72rem;
  color: var(--ss-text-muted);
}

.tl__cal-missing {
  color: var(--ss-warning, #f59e0b);
}

/* Empty */
.tl__empty {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem;
  color: var(--ss-text-muted);
  font-style: italic;
}

/* Body */
.tl__body {
  display: flex;
  overflow: hidden;
}

/* Label column */
.tl__labels {
  width: 140px;
  flex-shrink: 0;
  border-right: 1px solid var(--ss-border);
  background: var(--ss-parchment-dark);
}

.tl__ruler-spacer {
  border-bottom: 2px solid var(--ss-border);
}

.tl__label {
  display: flex;
  align-items: center;
  padding: 0 0.6rem;
  border-bottom: 1px solid var(--ss-border);
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--ss-text-muted);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  line-height: 1.2;
}

/* Canvas */
.tl__canvas {
  flex: 1;
  overflow-x: auto;
  overflow-y: visible;
  /* Custom scrollbar */
  scrollbar-width: thin;
  scrollbar-color: var(--ss-border) transparent;
}

.tl__inner {
  position: relative;
  min-width: 100%;
}

/* Ruler */
.tl__ruler {
  position: relative;
  background: var(--ss-parchment-dark);
  border-bottom: 2px solid var(--ss-border);
}

.tl__tick {
  position: absolute;
  top: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: translateX(-50%);
  pointer-events: none;
}

.tl__tick-line {
  width: 1px;
  height: 8px;
  background: var(--ss-border);
  flex-shrink: 0;
}

.tl__tick-line--major {
  height: 12px;
  background: color-mix(in srgb, var(--ss-primary) 50%, var(--ss-border));
}

.tl__tick-label {
  font-size: 0.6rem;
  color: var(--ss-text-muted);
  white-space: nowrap;
  margin-top: 1px;
  padding: 0 2px;
}

.tl__tick-label--major {
  color: var(--ss-text);
  font-weight: 600;
  font-size: 0.65rem;
}

/* Lanes */
.tl__lane {
  position: relative;
  border-bottom: 1px solid var(--ss-border);
  background: var(--ss-surface);
}

/* Events */
.tl__event {
  position: absolute;
  border-radius: 3px;
  border-width: 1px;
  border-style: solid;
  overflow: hidden;
  display: flex;
  align-items: center;
  padding: 0 5px;
  min-width: 4px;
}

.tl__event--link {
  cursor: pointer;
}

.tl__event--link:hover {
  filter: brightness(1.2);
}

.tl__event-label {
  font-size: 0.62rem;
  font-weight: 500;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  pointer-events: none;
  line-height: 1;
}
</style>
