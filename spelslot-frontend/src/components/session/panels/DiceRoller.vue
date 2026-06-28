<script setup lang="ts">
import { ref } from 'vue'

interface RollResult {
  id: number
  label: string
  rolls: number[]
  kept: number[] | null
  modifier: number
  total: number
}

const expr = ref('1d20')
const error = ref('')
const history = ref<RollResult[]>([])
let nextId = 1

const QUICK = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']

function roll(expression?: string) {
  const raw = (expression ?? expr.value).trim()
  if (!raw) return
  error.value = ''
  try {
    const result = parseDice(raw)
    history.value.unshift({ id: nextId++, label: raw, ...result })
    if (history.value.length > 30) history.value.pop()
    if (expression) expr.value = raw
  } catch {
    error.value = 'Invalid expression'
  }
}

function parseDice(raw: string): Omit<RollResult, 'id' | 'label'> {
  const str = raw.toLowerCase().replace(/\s+/g, '')
  // e.g. 2d6, 1d20+3, 4d6kh3, 2d20kl1, d20-1
  const m = str.match(/^(\d*)d(\d+)(?:(kh|kl)(\d+))?([+-]\d+)?$/)
  if (!m) throw new Error('invalid')

  const count = parseInt(m[1] || '1')
  const faces = parseInt(m[2])
  const keepMode = m[3] as 'kh' | 'kl' | undefined
  const keepN = m[4] ? parseInt(m[4]) : undefined
  const modifier = m[5] ? parseInt(m[5]) : 0

  if (count < 1 || count > 100 || faces < 2 || faces > 1000) throw new Error('range')

  const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * faces) + 1)

  let kept: number[] | null = null
  let sum: number

  if (keepMode && keepN) {
    const sorted = [...rolls].sort((a, b) => b - a)
    kept = keepMode === 'kh' ? sorted.slice(0, keepN) : sorted.slice(sorted.length - keepN)
    sum = kept.reduce((a, b) => a + b, 0) + modifier
  } else {
    sum = rolls.reduce((a, b) => a + b, 0) + modifier
  }

  return { rolls, kept, modifier, total: sum }
}

function isKept(result: RollResult, index: number): boolean {
  if (!result.kept) return true
  // Mark which original rolls were kept (highest/lowest N)
  const keptSet = [...result.kept]
  const copy = [...result.rolls]
  const marks = new Array(copy.length).fill(false)
  for (let i = 0; i < copy.length; i++) {
    const idx = keptSet.indexOf(copy[i])
    if (idx !== -1) {
      marks[i] = true
      keptSet.splice(idx, 1)
    }
  }
  return marks[index]
}

function handleKey(e: KeyboardEvent) {
  if (e.key === 'Enter') roll()
}

function isNatural(r: RollResult): boolean {
  if (r.rolls.length === 1 && r.label.toLowerCase().includes('d20')) {
    return r.rolls[0] === 20 || r.rolls[0] === 1
  }
  return false
}
</script>

<template>
  <div class="dice">
    <!-- Quick dice buttons -->
    <div class="dice__quick">
      <button
        v-for="d in QUICK"
        :key="d"
        class="dice__quick-btn"
        @click="roll(d)"
      >
        {{ d }}
      </button>
    </div>

    <!-- Custom expression -->
    <div class="dice__input-row">
      <input
        v-model="expr"
        class="dice__input"
        placeholder="2d6+3, 4d6kh3…"
        spellcheck="false"
        @keydown="handleKey"
      />
      <button class="dice__roll-btn" @click="roll()">
        <i class="pi pi-refresh" />
        Roll
      </button>
    </div>

    <p v-if="error" class="dice__error">{{ error }}</p>

    <!-- Roll history -->
    <div class="dice__history">
      <div v-if="history.length === 0" class="dice__empty">
        <i class="pi pi-circle" />
        Roll some dice
      </div>

      <div v-for="r in history" :key="r.id" class="dice__result">
        <div class="dice__result-header">
          <span class="dice__result-label">{{ r.label }}</span>
          <span class="dice__result-total" :class="{ 'dice__result-total--nat': isNatural(r) }">
            {{ r.total }}
          </span>
        </div>
        <div v-if="r.rolls.length > 1 || r.modifier !== 0" class="dice__result-detail">
          <span
            v-for="(val, i) in r.rolls"
            :key="i"
            class="dice__die"
            :class="{ 'dice__die--dropped': !isKept(r, i) }"
          >{{ val }}</span>
          <span v-if="r.modifier !== 0" class="dice__modifier">
            {{ r.modifier > 0 ? `+${r.modifier}` : r.modifier }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dice {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  padding: 0.6rem;
  gap: 0.5rem;
}

/* Quick buttons */
.dice__quick {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.dice__quick-btn {
  padding: 0.2rem 0.55rem;
  font-size: 0.72rem;
  font-weight: 700;
  font-family: var(--ss-font-mono, monospace);
  background: color-mix(in srgb, var(--ss-primary) 12%, transparent);
  color: var(--ss-primary);
  border: 1px solid color-mix(in srgb, var(--ss-primary) 30%, transparent);
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s;
}

.dice__quick-btn:hover {
  background: color-mix(in srgb, var(--ss-primary) 22%, transparent);
  border-color: color-mix(in srgb, var(--ss-primary) 55%, transparent);
}

/* Input row */
.dice__input-row {
  display: flex;
  gap: 0.4rem;
}

.dice__input {
  flex: 1;
  min-width: 0;
  padding: 0.3rem 0.6rem;
  font-size: 0.8rem;
  font-family: var(--ss-font-mono, monospace);
  background: var(--ss-parchment-dark, var(--ss-parchment));
  border: 1px solid var(--ss-border);
  border-radius: 4px;
  color: var(--ss-text);
}

.dice__input:focus {
  outline: none;
  border-color: var(--ss-primary);
}

.dice__roll-btn {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.75rem;
  font-size: 0.78rem;
  font-weight: 600;
  background: var(--ss-primary);
  color: var(--ss-primary-fg);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: opacity 0.1s;
  white-space: nowrap;
}

.dice__roll-btn:hover {
  opacity: 0.85;
}

.dice__error {
  font-size: 0.72rem;
  color: var(--ss-danger);
  margin: 0;
}

/* History */
.dice__history {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-height: 0;
}

.dice__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  height: 100%;
  font-size: 0.8rem;
  color: var(--ss-text-muted);
}

.dice__result {
  background: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-radius: 4px;
  padding: 0.35rem 0.6rem;
}

.dice__result-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.dice__result-label {
  font-size: 0.72rem;
  color: var(--ss-text-muted);
  font-family: var(--ss-font-mono, monospace);
}

.dice__result-total {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--ss-text);
  line-height: 1;
}

.dice__result-total--nat {
  color: var(--ss-primary);
}

.dice__result-detail {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2rem;
  margin-top: 0.2rem;
}

.dice__die {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.4em;
  height: 1.4em;
  font-size: 0.7rem;
  font-weight: 600;
  background: color-mix(in srgb, var(--ss-primary) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--ss-primary) 25%, transparent);
  border-radius: 3px;
  color: var(--ss-text);
}

.dice__die--dropped {
  background: none;
  border-color: var(--ss-border);
  color: var(--ss-text-muted);
  text-decoration: line-through;
  opacity: 0.5;
}

.dice__modifier {
  font-size: 0.72rem;
  color: var(--ss-text-muted);
  font-family: var(--ss-font-mono, monospace);
}
</style>
