<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSessionMonstersStore } from '@/stores/sessionMonsters'

interface Monster {
  id: string
  name: string
  hp: number
  maxHp: number
  ac: number
  initiative: number
  conditions: string[]
}

const props = defineProps<{
  sessionId: string | null
}>()

const DND_CONDITIONS = [
  'Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened',
  'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified',
  'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious',
]

const monstersStore = useSessionMonstersStore()
const pinnedMonsters = computed(() => monstersStore.pinnedMonsters)

const storageKey = computed(() => `spelslot-combat-${props.sessionId ?? 'draft'}`)

const monsters = ref<Monster[]>([])
const addForm = ref({ name: '', maxHp: '', ac: '', initiative: '' })
const showAdd = ref(false)
const editingHp = ref<string | null>(null)
const hpInput = ref('')
const adjustInput = ref<Record<string, string>>({})
const showConditions = ref<string | null>(null)

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey.value) ?? 'null')
    if (Array.isArray(saved)) monsters.value = saved
    else monsters.value = []
  } catch {
    monsters.value = []
  }
}

function save() {
  localStorage.setItem(storageKey.value, JSON.stringify(monsters.value))
}

watch(storageKey, load, { immediate: true })

const sorted = computed(() =>
  [...monsters.value].sort((a, b) => b.initiative - a.initiative),
)

function fillFromPinned(tab: typeof pinnedMonsters.value[number]) {
  addForm.value.name = tab.monster.name
  addForm.value.maxHp = String(tab.monster.hit_points)
  addForm.value.ac = String(tab.monster.armor_class)
  showAdd.value = true
}

function addMonster() {
  const name = addForm.value.name.trim()
  if (!name) return
  const maxHp = Math.max(1, parseInt(addForm.value.maxHp) || 10)
  monsters.value.push({
    id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    hp: maxHp,
    maxHp,
    ac: Math.max(1, parseInt(addForm.value.ac) || 10),
    initiative: parseInt(addForm.value.initiative) || 0,
    conditions: [],
  })
  save()
  addForm.value = { name: '', maxHp: '', ac: '', initiative: '' }
  showAdd.value = false
}

function removeMonster(id: string) {
  monsters.value = monsters.value.filter((m) => m.id !== id)
  save()
}

function startHpEdit(m: Monster) {
  editingHp.value = m.id
  hpInput.value = String(m.hp)
}

function commitHpEdit(m: Monster) {
  const v = parseInt(hpInput.value)
  if (!isNaN(v)) {
    m.hp = Math.min(m.maxHp, Math.max(0, v))
    save()
  }
  editingHp.value = null
}

function adjust(m: Monster, heal: boolean) {
  const val = parseInt(adjustInput.value[m.id] ?? '0') || 0
  if (heal) m.hp = Math.min(m.maxHp, m.hp + val)
  else m.hp = Math.max(0, m.hp - val)
  adjustInput.value[m.id] = ''
  save()
}

function toggleCondition(m: Monster, cond: string) {
  const idx = m.conditions.indexOf(cond)
  if (idx === -1) m.conditions.push(cond)
  else m.conditions.splice(idx, 1)
  save()
}

function hpPercent(m: Monster) {
  return Math.round((m.hp / m.maxHp) * 100)
}

function hpColor(pct: number) {
  if (pct > 60) return '#22c55e'
  if (pct > 30) return '#f59e0b'
  return '#ef4444'
}

function clearAll() {
  if (!confirm('Clear all monsters?')) return
  monsters.value = []
  save()
}
</script>

<template>
  <div class="ct">
    <!-- Toolbar -->
    <div class="ct__toolbar">
      <span class="ct__count">{{ monsters.length }} combatant{{ monsters.length !== 1 ? 's' : '' }}</span>
      <button class="ct__btn ct__btn--add" @click="showAdd = !showAdd">
        <i class="pi pi-plus" /> Add
      </button>
      <button v-if="monsters.length > 0" class="ct__btn ct__btn--danger" @click="clearAll">
        <i class="pi pi-trash" />
      </button>
    </div>

    <!-- Pinned monster quick-add chips (always visible when there are pinned monsters) -->
    <div v-if="pinnedMonsters.length" class="ct__pinned">
      <span class="ct__pinned-label">Pinned:</span>
      <button
        v-for="tab in pinnedMonsters"
        :key="tab.id"
        class="ct__pinned-chip"
        :title="`HP ${tab.monster.hit_points} · AC ${tab.monster.armor_class}`"
        @click="fillFromPinned(tab)"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Add monster form -->
    <div v-if="showAdd" class="ct__add-form">
      <input
        v-model="addForm.name"
        class="ct__input ct__input--name"
        placeholder="Name…"
        @keydown.enter="addMonster"
      />
      <div class="ct__add-row">
        <input v-model="addForm.initiative" class="ct__input ct__input--num" placeholder="Ini" type="number" />
        <input v-model="addForm.maxHp" class="ct__input ct__input--num" placeholder="HP" type="number" min="1" />
        <input v-model="addForm.ac" class="ct__input ct__input--num" placeholder="AC" type="number" min="1" />
      </div>
      <div class="ct__add-actions">
        <button class="ct__btn ct__btn--add" @click="addMonster">Add monster</button>
        <button class="ct__btn" @click="showAdd = false">Cancel</button>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="monsters.length === 0 && !showAdd" class="ct__empty">
      <i class="pi pi-shield ct__empty-icon" />
      <p>No combatants yet.</p>
      <button class="ct__btn ct__btn--add" @click="showAdd = true">
        <i class="pi pi-plus" /> Add first monster
      </button>
    </div>

    <!-- Monster list sorted by initiative -->
    <div class="ct__list">
      <div v-for="m in sorted" :key="m.id" class="ct__monster">
        <!-- Initiative badge + name -->
        <div class="ct__monster-header">
          <span class="ct__ini" :title="`Initiative: ${m.initiative}`">{{ m.initiative }}</span>
          <span class="ct__name">{{ m.name }}</span>
          <span class="ct__ac" title="Armor Class">AC {{ m.ac }}</span>
          <button class="ct__icon-btn" title="Remove" @click="removeMonster(m.id)">
            <i class="pi pi-times" />
          </button>
        </div>

        <!-- HP bar -->
        <div class="ct__hp-row">
          <div class="ct__hp-bar-wrap">
            <div
              class="ct__hp-bar"
              :style="{
                width: `${hpPercent(m)}%`,
                background: hpColor(hpPercent(m)),
              }"
            />
          </div>
          <!-- HP value: click to edit inline -->
          <div class="ct__hp-val">
            <template v-if="editingHp === m.id">
              <input
                v-model="hpInput"
                class="ct__hp-input"
                type="number"
                :min="0"
                :max="m.maxHp"
                @blur="commitHpEdit(m)"
                @keydown.enter="commitHpEdit(m)"
                @keydown.escape="editingHp = null"
                autofocus
              />
            </template>
            <button v-else class="ct__hp-num" :title="'Click to set HP'" @click="startHpEdit(m)">
              {{ m.hp }}
            </button>
            <span class="ct__hp-sep">/</span>
            <span class="ct__hp-max">{{ m.maxHp }}</span>
          </div>
        </div>

        <!-- Adjust HP -->
        <div class="ct__adjust-row">
          <input
            v-model="adjustInput[m.id]"
            class="ct__input ct__input--adjust"
            type="number"
            min="0"
            placeholder="Amt"
            @keydown.enter="adjust(m, false)"
          />
          <button class="ct__btn ct__btn--dmg" @click="adjust(m, false)" title="Deal damage">
            <i class="pi pi-minus" /> Dmg
          </button>
          <button class="ct__btn ct__btn--heal" @click="adjust(m, true)" title="Heal">
            <i class="pi pi-plus" /> Heal
          </button>
        </div>

        <!-- Conditions -->
        <div class="ct__conditions">
          <button
            v-for="cond in m.conditions"
            :key="cond"
            class="ct__cond-chip"
            :title="`Remove ${cond}`"
            @click="toggleCondition(m, cond)"
          >
            {{ cond }} <i class="pi pi-times" />
          </button>
          <div class="ct__cond-add">
            <button
              class="ct__cond-toggle"
              :class="{ 'ct__cond-toggle--open': showConditions === m.id }"
              @click="showConditions = showConditions === m.id ? null : m.id"
            >
              <i class="pi pi-tag" /> +
            </button>
            <div v-if="showConditions === m.id" class="ct__cond-picker">
              <button
                v-for="cond in DND_CONDITIONS"
                :key="cond"
                class="ct__cond-option"
                :class="{ 'ct__cond-option--active': m.conditions.includes(cond) }"
                @click="toggleCondition(m, cond)"
              >
                {{ cond }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ct {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-size: 0.82rem;
}

/* ── Toolbar ── */
.ct__toolbar {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--ss-border);
  flex-shrink: 0;
}

.ct__count {
  font-size: 0.72rem;
  color: var(--ss-text-muted);
  flex: 1;
}

.ct__btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.6rem;
  font-size: 0.72rem;
  font-weight: 600;
  border: 1px solid var(--ss-border);
  border-radius: 4px;
  background: var(--ss-surface);
  color: var(--ss-text-muted);
  cursor: pointer;
  transition: all 0.1s;
  white-space: nowrap;
}

.ct__btn:hover { color: var(--ss-text); border-color: var(--ss-text-muted); }
.ct__btn--add { border-color: var(--ss-primary); color: var(--ss-primary); }
.ct__btn--add:hover { background: color-mix(in srgb, var(--ss-primary) 10%, transparent); }
.ct__btn--danger { color: #ef4444; border-color: color-mix(in srgb, #ef4444 40%, transparent); }
.ct__btn--danger:hover { background: color-mix(in srgb, #ef4444 10%, transparent); }
.ct__btn--dmg { color: #ef4444; border-color: color-mix(in srgb, #ef4444 30%, transparent); }
.ct__btn--dmg:hover { background: color-mix(in srgb, #ef4444 10%, transparent); }
.ct__btn--heal { color: #22c55e; border-color: color-mix(in srgb, #22c55e 30%, transparent); }
.ct__btn--heal:hover { background: color-mix(in srgb, #22c55e 10%, transparent); }

/* ── Pinned monsters ── */
.ct__pinned {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem;
  padding: 0.35rem 0.75rem;
  border-bottom: 1px solid var(--ss-border);
  background: color-mix(in srgb, var(--ss-primary) 4%, transparent);
  flex-shrink: 0;
}

.ct__pinned-label {
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ss-text-muted);
  flex-shrink: 0;
}

.ct__pinned-chip {
  padding: 0.15rem 0.55rem;
  font-size: 0.68rem;
  font-weight: 600;
  background: color-mix(in srgb, var(--ss-primary) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--ss-primary) 35%, transparent);
  border-radius: 99px;
  color: var(--ss-primary);
  cursor: pointer;
  transition: background 0.1s;
}
.ct__pinned-chip:hover {
  background: color-mix(in srgb, var(--ss-primary) 20%, transparent);
}

/* ── Add form ── */
.ct__add-form {
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--ss-border);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  background: color-mix(in srgb, var(--ss-surface) 60%, var(--ss-parchment));
  flex-shrink: 0;
}

.ct__add-row {
  display: flex;
  gap: 0.4rem;
}

.ct__add-actions {
  display: flex;
  gap: 0.4rem;
}

.ct__input {
  background: var(--ss-parchment);
  border: 1px solid var(--ss-border);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  font-size: 0.78rem;
  color: var(--ss-text);
  outline: none;
  transition: border-color 0.15s;
}

.ct__input:focus { border-color: var(--ss-primary); }
.ct__input--name { width: 100%; }
.ct__input--num { width: 60px; }
.ct__input--adjust { width: 56px; text-align: center; }

/* ── Empty ── */
.ct__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem 1rem;
  color: var(--ss-text-muted);
  text-align: center;
}

.ct__empty-icon { font-size: 2rem; opacity: 0.3; }
.ct__empty p { margin: 0; font-size: 0.8rem; }

/* ── Monster list ── */
.ct__list {
  flex: 1;
  overflow-y: auto;
  padding: 0.4rem 0;
}

.ct__monster {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid color-mix(in srgb, var(--ss-border) 50%, transparent);
}

.ct__monster:last-child { border-bottom: none; }

.ct__monster-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.35rem;
}

.ct__ini {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--ss-primary) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--ss-primary) 40%, transparent);
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--ss-primary);
  flex-shrink: 0;
}

.ct__name {
  font-weight: 700;
  color: var(--ss-text);
  flex: 1;
  font-size: 0.85rem;
}

.ct__ac {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--ss-text-muted);
  white-space: nowrap;
}

.ct__icon-btn {
  background: none;
  border: none;
  color: var(--ss-text-muted);
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 0.6rem;
  transition: color 0.1s;
}

.ct__icon-btn:hover { color: #ef4444; }

/* ── HP ── */
.ct__hp-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.3rem;
}

.ct__hp-bar-wrap {
  flex: 1;
  height: 6px;
  background: color-mix(in srgb, var(--ss-border) 60%, transparent);
  border-radius: 99px;
  overflow: hidden;
}

.ct__hp-bar {
  height: 100%;
  border-radius: 99px;
  transition: width 0.2s, background 0.2s;
}

.ct__hp-val {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  font-size: 0.75rem;
}

.ct__hp-num {
  font-weight: 700;
  color: var(--ss-text);
  background: none;
  border: 1px dashed transparent;
  border-radius: 3px;
  padding: 1px 3px;
  cursor: pointer;
  font-size: 0.75rem;
  transition: border-color 0.15s;
  min-width: 24px;
  text-align: center;
}

.ct__hp-num:hover { border-color: var(--ss-primary); }

.ct__hp-input {
  width: 40px;
  font-size: 0.75rem;
  font-weight: 700;
  text-align: center;
  background: var(--ss-parchment);
  border: 1px solid var(--ss-primary);
  border-radius: 3px;
  padding: 1px 2px;
  color: var(--ss-text);
  outline: none;
}

.ct__hp-sep { color: var(--ss-text-muted); }
.ct__hp-max { color: var(--ss-text-muted); }

/* ── Adjust row ── */
.ct__adjust-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-bottom: 0.35rem;
}

/* ── Conditions ── */
.ct__conditions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: center;
}

.ct__cond-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.1rem 0.45rem;
  font-size: 0.65rem;
  font-weight: 600;
  background: color-mix(in srgb, #f59e0b 15%, transparent);
  border: 1px solid color-mix(in srgb, #f59e0b 40%, transparent);
  color: #f59e0b;
  border-radius: 99px;
  cursor: pointer;
  transition: background 0.1s;
}

.ct__cond-chip:hover { background: color-mix(in srgb, #ef4444 15%, transparent); color: #ef4444; border-color: color-mix(in srgb, #ef4444 40%, transparent); }
.ct__cond-chip .pi { font-size: 0.55rem; }

.ct__cond-add { position: relative; }

.ct__cond-toggle {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  padding: 0.1rem 0.4rem;
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--ss-text-muted);
  background: none;
  border: 1px dashed var(--ss-border);
  border-radius: 99px;
  cursor: pointer;
  transition: all 0.1s;
}

.ct__cond-toggle:hover,
.ct__cond-toggle--open { color: var(--ss-primary); border-color: var(--ss-primary); }

.ct__cond-picker {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0;
  background: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  box-shadow: 0 4px 16px rgba(0,0,0,0.25);
  padding: 0.4rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  width: 220px;
  z-index: 1000;
}

.ct__cond-option {
  padding: 0.15rem 0.5rem;
  font-size: 0.65rem;
  font-weight: 600;
  border: 1px solid var(--ss-border);
  border-radius: 99px;
  background: var(--ss-parchment);
  color: var(--ss-text-muted);
  cursor: pointer;
  transition: all 0.1s;
}

.ct__cond-option:hover { border-color: var(--ss-primary); color: var(--ss-primary); }
.ct__cond-option--active { background: color-mix(in srgb, #f59e0b 15%, transparent); border-color: #f59e0b; color: #f59e0b; }
</style>
