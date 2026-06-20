<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { monsterService, type Monster, type MonsterSummary } from '@/services/monsterService'
import { useSessionMonstersStore } from '@/stores/sessionMonsters'

const store = useSessionMonstersStore()
const tabs = computed(() => store.tabs)
const activeId = computed({
  get: () => store.activeId,
  set: (v) => { store.activeId = v },
})
const adding = ref(false)       // add-panel open
const addMode = ref<'search' | 'url' | 'image'>('search')

// ── Add panel state ───────────────────────────────────────────────────────
const searchQuery = ref('')
const suggestions = ref<MonsterSummary[]>([])
const searchLoading = ref(false)
const addLoading = ref(false)
const addError = ref<string | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const urlInput = ref('')
const urlAlternatives = ref<MonsterSummary[]>([])

let searchTimeout: ReturnType<typeof setTimeout> | null = null

function openAdd() {
  adding.value = true
  addMode.value = 'search'
  searchQuery.value = ''
  suggestions.value = []
  addError.value = null
}

function closeAdd() {
  adding.value = false
  searchQuery.value = ''
  suggestions.value = []
  addError.value = null
}

function switchAddMode(m: 'search' | 'url' | 'image') {
  addMode.value = m
  searchQuery.value = ''
  suggestions.value = []
  urlInput.value = ''
  urlAlternatives.value = []
  addError.value = null
}

// ── Search ────────────────────────────────────────────────────────────────
function onSearchInput() {
  if (searchTimeout) clearTimeout(searchTimeout)
  addError.value = null
  if (!searchQuery.value.trim() || searchQuery.value.trim().length < 2) {
    suggestions.value = []
    return
  }
  searchTimeout = setTimeout(async () => {
    searchLoading.value = true
    const result = await monsterService.search(searchQuery.value.trim())
    searchLoading.value = false
    if (result.type === 'ok') suggestions.value = result.data
  }, 300)
}

async function selectMonster(summary: MonsterSummary) {
  suggestions.value = []
  addLoading.value = true
  addError.value = null
  const result = await monsterService.get(summary.slug)
  addLoading.value = false
  if (result.type === 'error') {
    addError.value = result.message
    return
  }
  store.addMonsterTab(result.data)
  closeAdd()
}

// ── URL ───────────────────────────────────────────────────────────────────
async function loadFromUrl() {
  const url = urlInput.value.trim()
  if (!url) return
  addLoading.value = true
  addError.value = null
  urlAlternatives.value = []
  const result = await monsterService.fromUrl(url)
  addLoading.value = false
  if (result.type === 'error') {
    addError.value = result.message
    return
  }
  const { monster, alternatives } = result.data
  store.addMonsterTab(monster as Monster)
  if (alternatives.length > 1) urlAlternatives.value = alternatives.slice(1)
  closeAdd()
}

// ── Image ─────────────────────────────────────────────────────────────────
function browseFile() {
  fileInputRef.value?.click()
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  store.addImageTab(file.name.replace(/\.[^.]+$/, ''), URL.createObjectURL(file))
  if (fileInputRef.value) fileInputRef.value.value = ''
  closeAdd()
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  const file = e.dataTransfer?.files?.[0]
  if (!file || !file.type.startsWith('image/')) return
  store.addImageTab(file.name.replace(/\.[^.]+$/, ''), URL.createObjectURL(file))
  closeAdd()
}

// ── Clipboard paste ───────────────────────────────────────────────────────
function onGlobalPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of Array.from(items)) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (!file) continue
      store.addImageTab('Pasted screenshot', URL.createObjectURL(file))
      if (adding.value) closeAdd()
      break
    }
  }
}

onMounted(() => document.addEventListener('paste', onGlobalPaste))
onUnmounted(() => document.removeEventListener('paste', onGlobalPaste))

// ── Tab management ────────────────────────────────────────────────────────
const activeTab = computed(() => store.tabs.find((t) => t.id === store.activeId) ?? null)

function closeTab(id: number, e: MouseEvent) {
  e.stopPropagation()
  store.removeTab(id)
  if (store.tabs.length === 0) adding.value = true
}

// ── Stat block helpers ────────────────────────────────────────────────────
function mod(score: number): string {
  const m = Math.floor((score - 10) / 2)
  return m >= 0 ? `+${m}` : `${m}`
}

const statKeys = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const
const statLabels = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']

function speedStr(speed: Record<string, number>): string {
  return Object.entries(speed)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => (k === 'walk' ? `${v} ft.` : `${k} ${v} ft.`))
    .join(', ')
}

function tabSaves(m: Monster) {
  return [
    { label: 'Str', val: m.strength_save },
    { label: 'Dex', val: m.dexterity_save },
    { label: 'Con', val: m.constitution_save },
    { label: 'Int', val: m.intelligence_save },
    { label: 'Wis', val: m.wisdom_save },
    { label: 'Cha', val: m.charisma_save },
  ].filter((p): p is { label: string; val: number } => p.val != null)
}

function tabSkills(m: Monster) {
  if (!m.skills) return []
  return Object.entries(m.skills).map(([k, v]) => ({
    label: k.charAt(0).toUpperCase() + k.slice(1),
    val: (v as number) >= 0 ? `+${v}` : `${v}`,
  }))
}

function fmtBonus(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}
</script>

<template>
  <div class="msb">

    <!-- ── Tab bar ── -->
    <div class="msb__tabbar">
      <div class="msb__tabs-scroll">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="['msb__tab', { 'msb__tab--active': tab.id === activeId }]"
          @click="activeId = tab.id; adding = false"
        >
          <i :class="['pi', tab.type === 'image' ? 'pi-image' : 'pi-book']" />
          <span class="msb__tab-label">{{ tab.label }}</span>
          <span class="msb__tab-close" @click="closeTab(tab.id, $event)">×</span>
        </button>
      </div>
      <button class="msb__add-btn" :class="{ 'msb__add-btn--active': adding }" title="Add monster" @click="adding ? closeAdd() : openAdd()">
        <i class="pi pi-plus" />
      </button>
    </div>

    <!-- ── Add panel ── -->
    <div v-if="adding" class="msb__add-panel">
      <!-- Mode toggle -->
      <div class="msb__add-modes">
        <button :class="['msb__add-mode', { 'msb__add-mode--active': addMode === 'search' }]" @click="switchAddMode('search')">
          Search
        </button>
        <button :class="['msb__add-mode', { 'msb__add-mode--active': addMode === 'url' }]" @click="switchAddMode('url')">
          URL
        </button>
        <button :class="['msb__add-mode', { 'msb__add-mode--active': addMode === 'image' }]" @click="switchAddMode('image')">
          Image
        </button>
      </div>

      <!-- Search -->
      <template v-if="addMode === 'search'">
        <div class="msb__search-row">
          <input
            v-model="searchQuery"
            class="msb__search"
            type="text"
            placeholder="Monster name…"
            autocomplete="off"
            @input="onSearchInput"
          />
          <i v-if="searchLoading || addLoading" class="pi pi-spin pi-spinner msb__spin" />
        </div>
        <ul v-if="suggestions.length" class="msb__suggestions">
          <li
            v-for="s in suggestions"
            :key="s.slug"
            class="msb__suggestion"
            @click="selectMonster(s)"
          >
            <span class="msb__suggestion-name">{{ s.name }}</span>
            <span class="msb__suggestion-meta">CR {{ s.challenge_rating }} · {{ s.size }} {{ s.type }}</span>
          </li>
        </ul>
        <p v-if="addError" class="msb__add-error">{{ addError }}</p>
      </template>

      <!-- URL -->
      <template v-else-if="addMode === 'url'">
        <div class="msb__url-row">
          <input
            v-model="urlInput"
            class="msb__search"
            type="url"
            placeholder="https://www.dndbeyond.com/monsters/goblin"
            @keydown.enter="loadFromUrl"
          />
          <button class="msb__url-go" :disabled="addLoading || !urlInput.trim()" @click="loadFromUrl">
            <i v-if="addLoading" class="pi pi-spin pi-spinner" />
            <i v-else class="pi pi-arrow-right" />
          </button>
        </div>
        <p class="msb__url-hint">Works with dndbeyond.com and 5e.tools URLs. Finds the closest match in Open5e's database — non-SRD homebrew won't be found.</p>
      </template>

      <!-- Image -->
      <template v-else>
        <div
          class="msb__drop-target"
          @dragover.prevent
          @drop="onDrop"
          @click="browseFile"
        >
          <i class="pi pi-upload" />
          <span>Drop, paste (Ctrl+V), or click to browse</span>
        </div>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          class="msb__file-input"
          @change="onFileChange"
        />
      </template>
    </div>

    <!-- ── Empty (no tabs, no add panel) ── -->
    <div v-if="!adding && tabs.length === 0" class="msb__empty">
      <i class="pi pi-book" style="font-size:1.6rem;opacity:0.2" />
      <p>No stat blocks loaded</p>
      <button class="msb__empty-add" @click="openAdd()">
        <i class="pi pi-plus" /> Add monster
      </button>
      <p class="msb__hint">Tip: Ctrl+V pastes a screenshot directly</p>
    </div>

    <!-- ── Content area ── -->
    <template v-else-if="activeTab && !adding">
      <!-- Image view -->
      <div v-if="activeTab.type === 'image'" class="msb__image-area">
        <img :src="activeTab.imageUrl!" class="msb__image" :alt="activeTab.label" />
      </div>

      <!-- Stat block view -->
      <div v-else-if="activeTab.monster" class="msb__block">
        <div class="msb__header">
          <div class="msb__name">{{ activeTab.monster.name }}</div>
          <div class="msb__meta">
            {{ activeTab.monster.size }} {{ activeTab.monster.type }}<template v-if="activeTab.monster.subtype"> ({{ activeTab.monster.subtype }})</template>, {{ activeTab.monster.alignment }}
          </div>
        </div>

        <div class="msb__divider" />

        <div class="msb__core">
          <div class="msb__core-row">
            <span class="msb__label">Armor Class</span>
            <span>{{ activeTab.monster.armor_class }}<template v-if="activeTab.monster.armor_desc"> ({{ activeTab.monster.armor_desc }})</template></span>
          </div>
          <div class="msb__core-row">
            <span class="msb__label">Hit Points</span>
            <span>{{ activeTab.monster.hit_points }} ({{ activeTab.monster.hit_dice }})</span>
          </div>
          <div class="msb__core-row">
            <span class="msb__label">Speed</span>
            <span>{{ speedStr(activeTab.monster.speed) }}</span>
          </div>
        </div>

        <div class="msb__divider" />

        <div class="msb__abilities">
          <div v-for="(key, i) in statKeys" :key="key" class="msb__ability">
            <div class="msb__ability-label">{{ statLabels[i] }}</div>
            <div class="msb__ability-score">{{ activeTab.monster[key] }}</div>
            <div class="msb__ability-mod">{{ mod(activeTab.monster[key]) }}</div>
          </div>
        </div>

        <div class="msb__divider" />

        <div class="msb__traits">
          <div v-if="tabSaves(activeTab.monster).length" class="msb__trait-row">
            <span class="msb__label">Saving Throws</span>
            <span>{{ tabSaves(activeTab.monster).map(s => `${s.label} ${fmtBonus(s.val)}`).join(', ') }}</span>
          </div>
          <div v-if="tabSkills(activeTab.monster).length" class="msb__trait-row">
            <span class="msb__label">Skills</span>
            <span>{{ tabSkills(activeTab.monster).map(s => `${s.label} ${s.val}`).join(', ') }}</span>
          </div>
          <div v-if="activeTab.monster.damage_vulnerabilities" class="msb__trait-row">
            <span class="msb__label">Damage Vulnerabilities</span>
            <span>{{ activeTab.monster.damage_vulnerabilities }}</span>
          </div>
          <div v-if="activeTab.monster.damage_resistances" class="msb__trait-row">
            <span class="msb__label">Damage Resistances</span>
            <span>{{ activeTab.monster.damage_resistances }}</span>
          </div>
          <div v-if="activeTab.monster.damage_immunities" class="msb__trait-row">
            <span class="msb__label">Damage Immunities</span>
            <span>{{ activeTab.monster.damage_immunities }}</span>
          </div>
          <div v-if="activeTab.monster.condition_immunities" class="msb__trait-row">
            <span class="msb__label">Condition Immunities</span>
            <span>{{ activeTab.monster.condition_immunities }}</span>
          </div>
          <div class="msb__trait-row">
            <span class="msb__label">Senses</span>
            <span>{{ activeTab.monster.senses }}</span>
          </div>
          <div class="msb__trait-row">
            <span class="msb__label">Languages</span>
            <span>{{ activeTab.monster.languages || '—' }}</span>
          </div>
          <div class="msb__trait-row">
            <span class="msb__label">Challenge</span>
            <span>{{ activeTab.monster.challenge_rating }}</span>
          </div>
        </div>

        <div v-if="activeTab.monster.special_abilities?.length" class="msb__divider" />

        <div v-if="activeTab.monster.special_abilities?.length" class="msb__section">
          <div v-for="a in activeTab.monster.special_abilities" :key="a.name" class="msb__feature">
            <span class="msb__feature-name">{{ a.name }}.</span> {{ a.desc }}
          </div>
        </div>

        <div v-if="activeTab.monster.actions?.length" class="msb__section">
          <div class="msb__section-title">Actions</div>
          <div v-for="a in activeTab.monster.actions" :key="a.name" class="msb__feature">
            <span class="msb__feature-name">{{ a.name }}.</span> {{ a.desc }}
          </div>
        </div>

        <div v-if="activeTab.monster.bonus_actions?.length" class="msb__section">
          <div class="msb__section-title">Bonus Actions</div>
          <div v-for="a in activeTab.monster.bonus_actions" :key="a.name" class="msb__feature">
            <span class="msb__feature-name">{{ a.name }}.</span> {{ a.desc }}
          </div>
        </div>

        <div v-if="activeTab.monster.reactions?.length" class="msb__section">
          <div class="msb__section-title">Reactions</div>
          <div v-for="a in activeTab.monster.reactions" :key="a.name" class="msb__feature">
            <span class="msb__feature-name">{{ a.name }}.</span> {{ a.desc }}
          </div>
        </div>

        <div v-if="activeTab.monster.legendary_actions?.length" class="msb__section">
          <div class="msb__section-title">Legendary Actions</div>
          <p v-if="activeTab.monster.legendary_desc" class="msb__legendary-desc">{{ activeTab.monster.legendary_desc }}</p>
          <div v-for="a in activeTab.monster.legendary_actions" :key="a.name" class="msb__feature">
            <span class="msb__feature-name">{{ a.name }}.</span> {{ a.desc }}
          </div>
        </div>

        <div class="msb__source">{{ activeTab.monster.document__title }}</div>
      </div>
    </template>

  </div>
</template>

<style scoped>
.msb {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  font-size: 0.8rem;
}

/* ── Tab bar ── */
.msb__tabbar {
  display: flex;
  align-items: stretch;
  flex-shrink: 0;
  border-bottom: 1px solid var(--ss-border);
  background: color-mix(in srgb, var(--ss-shell) 30%, transparent);
  min-height: 32px;
}

.msb__tabs-scroll {
  display: flex;
  overflow-x: auto;
  flex: 1;
  scrollbar-width: none;
}
.msb__tabs-scroll::-webkit-scrollbar { display: none; }

.msb__tab {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0 0.55rem;
  background: none;
  border: none;
  border-right: 1px solid var(--ss-border);
  border-bottom: 2px solid transparent;
  font-size: 0.68rem;
  color: var(--ss-text-muted);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  margin-bottom: -1px;
  transition: color 0.12s;
}
.msb__tab:hover { color: var(--ss-text); }
.msb__tab--active {
  color: var(--ss-text);
  border-bottom-color: var(--ss-primary);
  background: color-mix(in srgb, var(--ss-primary) 6%, transparent);
}

.msb__tab-label {
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.msb__tab-close {
  font-size: 0.85rem;
  line-height: 1;
  opacity: 0.4;
  padding: 0 0.1rem;
  cursor: pointer;
}
.msb__tab-close:hover { opacity: 1; color: var(--ss-danger, #ef4444); }

.msb__add-btn {
  flex-shrink: 0;
  width: 32px;
  background: none;
  border: none;
  border-left: 1px solid var(--ss-border);
  color: var(--ss-text-muted);
  cursor: pointer;
  font-size: 0.7rem;
  transition: color 0.12s, background 0.12s;
}
.msb__add-btn:hover { color: var(--ss-primary); }
.msb__add-btn--active { color: var(--ss-primary); background: color-mix(in srgb, var(--ss-primary) 8%, transparent); }

/* ── Add panel ── */
.msb__add-panel {
  flex-shrink: 0;
  border-bottom: 1px solid var(--ss-border);
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  background: color-mix(in srgb, var(--ss-primary) 3%, transparent);
}

.msb__add-modes {
  display: flex;
  gap: 0.3rem;
}

.msb__add-mode {
  flex: 1;
  background: none;
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  padding: 0.2rem 0.4rem;
  font-size: 0.7rem;
  color: var(--ss-text-muted);
  cursor: pointer;
}
.msb__add-mode:hover { border-color: var(--ss-primary); color: var(--ss-text); }
.msb__add-mode--active {
  border-color: var(--ss-primary);
  background: color-mix(in srgb, var(--ss-primary) 10%, transparent);
  color: var(--ss-primary);
  font-weight: 600;
}

/* Search inside add panel */
.msb__search-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.msb__search {
  flex: 1;
  background: var(--ss-parchment-dark);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  padding: 0.28rem 0.5rem;
  font-size: 0.78rem;
  color: var(--ss-text);
  outline: none;
}
.msb__search:focus { border-color: var(--ss-primary); }

.msb__spin { color: var(--ss-text-muted); font-size: 0.72rem; flex-shrink: 0; }

.msb__suggestions {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  background: var(--ss-surface, var(--ss-parchment));
  max-height: 180px;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.msb__suggestion {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 0.3rem 0.55rem;
  cursor: pointer;
  gap: 0.5rem;
}
.msb__suggestion:hover { background: color-mix(in srgb, var(--ss-primary) 10%, transparent); }
.msb__suggestion-name { font-weight: 600; color: var(--ss-text); font-size: 0.78rem; }
.msb__suggestion-meta { font-size: 0.65rem; color: var(--ss-text-muted); white-space: nowrap; }

.msb__add-error {
  font-size: 0.7rem;
  color: var(--ss-danger, #ef4444);
  margin: 0;
}

/* URL mode */
.msb__url-row {
  display: flex;
  gap: 0.3rem;
}

.msb__url-go {
  flex-shrink: 0;
  width: 30px;
  background: var(--ss-primary);
  border: none;
  border-radius: var(--ss-radius);
  color: #fff;
  cursor: pointer;
  font-size: 0.72rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
.msb__url-go:disabled { opacity: 0.4; cursor: not-allowed; }
.msb__url-go:not(:disabled):hover { filter: brightness(1.1); }

.msb__url-hint {
  font-size: 0.65rem;
  color: var(--ss-text-muted);
  opacity: 0.75;
  margin: 0;
  line-height: 1.4;
}

/* Image drop target */
.msb__drop-target {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 2px dashed var(--ss-border);
  border-radius: var(--ss-radius);
  padding: 0.6rem;
  font-size: 0.72rem;
  color: var(--ss-text-muted);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.msb__drop-target:hover { border-color: var(--ss-primary); color: var(--ss-text); }

.msb__file-input {
  display: none;
}

/* ── Empty ── */
.msb__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--ss-text-muted);
  font-size: 0.78rem;
  text-align: center;
  padding: 1rem;
}

.msb__empty-add {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  background: none;
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  padding: 0.3rem 0.75rem;
  font-size: 0.72rem;
  color: var(--ss-primary);
  cursor: pointer;
  margin-top: 0.25rem;
}
.msb__empty-add:hover { background: color-mix(in srgb, var(--ss-primary) 8%, transparent); }

/* ── Image area ── */
.msb__image-area {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.msb__image {
  width: 100%;
  display: block;
  border-radius: var(--ss-radius);
}

/* ── Stat block ── */
.msb__block {
  flex: 1;
  overflow-y: auto;
  padding: 0.6rem 0.7rem;
}

.msb__header { margin-bottom: 0.2rem; }

.msb__name {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--ss-primary);
  line-height: 1.2;
}

.msb__meta {
  font-size: 0.72rem;
  color: var(--ss-text-muted);
  font-style: italic;
}

.msb__divider {
  border: none;
  border-top: 2px solid var(--ss-primary);
  opacity: 0.35;
  margin: 0.4rem 0;
}

.msb__core { display: flex; flex-direction: column; gap: 0.12rem; }

.msb__core-row {
  display: flex;
  gap: 0.4rem;
  line-height: 1.4;
}

.msb__label {
  font-weight: 700;
  color: var(--ss-primary);
  flex-shrink: 0;
}

.msb__abilities {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.25rem;
  text-align: center;
}

.msb__ability-label {
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ss-primary);
}

.msb__ability-score {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--ss-text);
  line-height: 1.2;
}

.msb__ability-mod {
  font-size: 0.7rem;
  color: var(--ss-text-muted);
}

.msb__traits { display: flex; flex-direction: column; gap: 0.1rem; }

.msb__trait-row {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  line-height: 1.45;
}

.msb__section {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding-top: 0.35rem;
}

.msb__section-title {
  font-size: 0.88rem;
  font-weight: 700;
  font-variant: small-caps;
  letter-spacing: 0.04em;
  color: var(--ss-primary);
  border-bottom: 1px solid color-mix(in srgb, var(--ss-primary) 30%, transparent);
  padding-bottom: 0.1rem;
  margin-bottom: 0.1rem;
}

.msb__feature { line-height: 1.5; color: var(--ss-text); }
.msb__feature-name { font-weight: 700; font-style: italic; }

.msb__legendary-desc {
  font-size: 0.75rem;
  color: var(--ss-text-muted);
  font-style: italic;
  margin: 0 0 0.3rem;
  line-height: 1.45;
}

.msb__source {
  margin-top: 0.6rem;
  font-size: 0.62rem;
  color: var(--ss-text-muted);
  opacity: 0.5;
  text-align: right;
  font-style: italic;
}
</style>
