<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

const props = defineProps<{ panelId: string }>()

const label = ref('Counter')
const value = ref(0)
const maxVal = ref<number | null>(null)
const editingMax = ref(false)
const maxRaw = ref('')

const storageKey = () => `spelslot-counter-${props.panelId}`

function load() {
  try {
    const raw = localStorage.getItem(storageKey())
    if (raw) {
      const s = JSON.parse(raw)
      label.value = s.label ?? 'Counter'
      value.value = s.value ?? 0
      maxVal.value = s.max ?? null
    }
  } catch {}
}

function save() {
  localStorage.setItem(storageKey(), JSON.stringify({ label: label.value, value: value.value, max: maxVal.value }))
}

onMounted(load)
watch([label, value, maxVal], save)

function adjust(delta: number) {
  value.value += delta
  if (maxVal.value !== null) value.value = Math.min(value.value, maxVal.value)
}

function reset() {
  value.value = maxVal.value ?? 0
}

function startEditMax() {
  maxRaw.value = maxVal.value !== null ? String(maxVal.value) : ''
  editingMax.value = true
}

function applyMax() {
  editingMax.value = false
  const n = parseInt(maxRaw.value)
  maxVal.value = !isNaN(n) && n > 0 ? n : null
}

function clearMax() {
  maxVal.value = null
}
</script>

<template>
  <div class="ctr">
    <input
      v-model="label"
      class="ctr__label"
      placeholder="Counter name…"
      spellcheck="false"
    />

    <div class="ctr__display">
      <span class="ctr__value">{{ value }}</span>
      <span v-if="maxVal !== null" class="ctr__max"> / {{ maxVal }}</span>
    </div>

    <div class="ctr__btns">
      <button class="ctr__btn ctr__btn--minus" @click="adjust(-10)">−10</button>
      <button class="ctr__btn ctr__btn--minus" @click="adjust(-5)">−5</button>
      <button class="ctr__btn ctr__btn--minus" @click="adjust(-1)">−1</button>
      <button class="ctr__btn ctr__btn--plus" @click="adjust(1)">+1</button>
      <button class="ctr__btn ctr__btn--plus" @click="adjust(5)">+5</button>
      <button class="ctr__btn ctr__btn--plus" @click="adjust(10)">+10</button>
    </div>

    <div class="ctr__footer">
      <button class="ctr__foot-btn" :title="maxVal !== null ? 'Reset to max' : 'Reset to 0'" @click="reset">
        <i class="pi pi-refresh" /> Reset
      </button>
      <template v-if="!editingMax">
        <button v-if="maxVal !== null" class="ctr__foot-btn" @click="startEditMax">
          <i class="pi pi-sliders-h" /> Max: {{ maxVal }}
        </button>
        <button v-else class="ctr__foot-btn" @click="startEditMax">
          <i class="pi pi-sliders-h" /> Set max
        </button>
      </template>
      <template v-else>
        <input
          v-model="maxRaw"
          class="ctr__max-input"
          type="number"
          min="1"
          placeholder="Max…"
          @keydown.enter="applyMax"
          @keydown.escape="editingMax = false"
          @blur="applyMax"
        />
        <button v-if="maxVal !== null" class="ctr__foot-btn ctr__foot-btn--clear" @click="clearMax">
          <i class="pi pi-times" />
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.ctr {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.6rem;
  height: 100%;
  gap: 0.45rem;
}

.ctr__label {
  width: 100%;
  padding: 0.3rem 0.5rem;
  font-size: 0.78rem;
  font-weight: 600;
  text-align: center;
  background: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-radius: 4px;
  color: var(--ss-text);
}

.ctr__label:focus {
  outline: none;
  border-color: var(--ss-primary);
}

.ctr__display {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ctr__value {
  font-size: 3.2rem;
  font-weight: 700;
  line-height: 1;
  color: var(--ss-text);
  font-variant-numeric: tabular-nums;
}

.ctr__max {
  font-size: 1.2rem;
  color: var(--ss-text-muted);
  font-weight: 500;
  align-self: flex-end;
  margin-bottom: 0.35rem;
}

.ctr__btns {
  display: flex;
  gap: 0.25rem;
  width: 100%;
}

.ctr__btn {
  flex: 1;
  padding: 0.38rem 0;
  font-size: 0.72rem;
  font-weight: 700;
  border: 1px solid;
  border-radius: 4px;
  cursor: pointer;
  transition: opacity 0.1s;
}

.ctr__btn:hover {
  opacity: 0.78;
}

.ctr__btn--minus {
  background: color-mix(in srgb, var(--ss-danger) 12%, transparent);
  color: var(--ss-danger);
  border-color: color-mix(in srgb, var(--ss-danger) 30%, transparent);
}

.ctr__btn--plus {
  background: color-mix(in srgb, var(--ss-primary) 12%, transparent);
  color: var(--ss-primary);
  border-color: color-mix(in srgb, var(--ss-primary) 30%, transparent);
}

.ctr__footer {
  display: flex;
  gap: 0.35rem;
  width: 100%;
}

.ctr__foot-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  padding: 0.28rem 0.4rem;
  font-size: 0.69rem;
  color: var(--ss-text-muted);
  background: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-radius: 4px;
  cursor: pointer;
  transition: color 0.1s, border-color 0.1s;
  white-space: nowrap;
}

.ctr__foot-btn:hover {
  color: var(--ss-text);
  border-color: var(--ss-primary);
}

.ctr__foot-btn--clear {
  flex: 0 0 auto;
  padding: 0.28rem 0.5rem;
}

.ctr__max-input {
  flex: 1;
  padding: 0.28rem 0.5rem;
  font-size: 0.72rem;
  background: var(--ss-surface);
  border: 1px solid var(--ss-primary);
  border-radius: 4px;
  color: var(--ss-text);
  min-width: 0;
}

.ctr__max-input:focus {
  outline: none;
}
</style>
