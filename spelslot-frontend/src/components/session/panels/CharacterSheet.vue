<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ddbService, type DdbCharacter } from '@/services/ddbService'

const props = defineProps<{
  characterId: string | null
}>()

const character = ref<DdbCharacter | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const stale = ref(false)
const refreshing = ref(false)

const STAT_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
const STAT_LABELS: Record<string, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
}
const SAVE_LABELS: Record<string, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
}

const classLabel = computed(() => {
  if (!character.value) return ''
  return character.value.classes
    .map((c) => `${c.name}${c.subclass ? ` (${c.subclass})` : ''} ${c.level}`)
    .join(' / ')
})

const ddbUrl = computed(() =>
  props.characterId ? `https://www.dndbeyond.com/characters/${props.characterId}` : null
)

function fmtMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`
}

function saveMod(key: typeof STAT_KEYS[number]): string {
  if (!character.value) return ''
  const base = character.value.modifiers[key]
  const prof = character.value.savingThrowProficiencies?.includes(key)
    ? character.value.proficiencyBonus : 0
  return fmtMod(base + prof)
}

function hasProf(key: typeof STAT_KEYS[number]): boolean {
  return character.value?.savingThrowProficiencies?.includes(key) ?? false
}

async function load() {
  if (!props.characterId) return
  loading.value = true
  error.value = null
  const result = await ddbService.getCharacter(props.characterId)
  loading.value = false
  if (result.type === 'ok') {
    character.value = result.data.character
    stale.value = result.data.stale ?? false
  } else {
    error.value = result.message
  }
}

async function refresh() {
  if (!props.characterId) return
  refreshing.value = true
  error.value = null
  const result = await ddbService.refreshCharacter(props.characterId)
  refreshing.value = false
  if (result.type === 'ok') {
    character.value = result.data.character
    stale.value = false
  } else {
    error.value = result.message
  }
}

onMounted(load)
</script>

<template>
  <div class="char-sheet">

    <!-- No character linked -->
    <div v-if="!characterId" class="char-sheet__empty">
      <i class="pi pi-user char-sheet__empty-icon" />
      <p>No DnD Beyond character linked.</p>
      <p class="char-sheet__empty-hint">Ask an admin to add your character ID in the admin panel.</p>
    </div>

    <!-- Loading -->
    <div v-else-if="loading" class="char-sheet__loading">
      <i class="pi pi-spin pi-spinner" /> Loading character…
    </div>

    <!-- Error -->
    <div v-else-if="error && !character" class="char-sheet__error">
      <i class="pi pi-exclamation-circle" />
      <p>{{ error }}</p>
      <p class="char-sheet__error-hint">Character ID: {{ characterId }}</p>
      <button class="char-sheet__retry" @click="load">Retry</button>
    </div>

    <!-- Character data -->
    <template v-else-if="character">

      <!-- Header -->
      <div class="char-sheet__header">
        <img
          v-if="character.avatarUrl"
          :src="character.avatarUrl"
          :alt="character.name"
          class="char-sheet__avatar"
        />
        <div v-else class="char-sheet__avatar char-sheet__avatar--placeholder">
          <i class="pi pi-user" />
        </div>
        <div class="char-sheet__identity">
          <span class="char-sheet__name">{{ character.name }}</span>
          <span class="char-sheet__class">{{ classLabel }}</span>
          <div class="char-sheet__badges">
            <span class="char-sheet__badge">Lvl {{ character.totalLevel }}</span>
            <span class="char-sheet__badge">Prof {{ fmtMod(character.proficiencyBonus) }}</span>
          </div>
        </div>
        <div class="char-sheet__header-actions">
          <a
            v-if="ddbUrl"
            :href="ddbUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="char-sheet__ddb-link"
            title="Open full sheet on DnD Beyond"
          >
            <i class="pi pi-external-link" />
          </a>
          <button
            class="char-sheet__refresh"
            :class="{ 'char-sheet__refresh--spinning': refreshing }"
            :disabled="refreshing"
            title="Sync from DnD Beyond"
            @click="refresh"
          >
            <i class="pi pi-refresh" />
          </button>
        </div>
      </div>

      <!-- Stale warning -->
      <div v-if="stale" class="char-sheet__stale">
        <i class="pi pi-exclamation-triangle" /> Showing cached data — DnD Beyond may be unavailable.
      </div>

      <!-- AC · HP · Speed row -->
      <div class="char-sheet__vitals">
        <div class="char-sheet__vital">
          <span class="char-sheet__vital-label">AC</span>
          <span class="char-sheet__vital-value">{{ character.armorClass }}</span>
        </div>
        <div class="char-sheet__vital">
          <span class="char-sheet__vital-label">Max HP</span>
          <span class="char-sheet__vital-value">{{ character.maxHp }}</span>
        </div>
        <div class="char-sheet__vital">
          <span class="char-sheet__vital-label">Speed</span>
          <span class="char-sheet__vital-value">{{ character.speed }} ft</span>
        </div>
      </div>

      <!-- Ability scores -->
      <div class="char-sheet__abilities">
        <div
          v-for="key in STAT_KEYS"
          :key="key"
          class="char-sheet__ability"
        >
          <span class="char-sheet__ability-label">{{ STAT_LABELS[key] }}</span>
          <span class="char-sheet__ability-mod">{{ fmtMod(character.modifiers[key]) }}</span>
          <span class="char-sheet__ability-score">{{ character.stats[key] }}</span>
        </div>
      </div>

      <!-- Saving throws -->
      <div class="char-sheet__section-title">Saving Throws</div>
      <div class="char-sheet__saves">
        <div
          v-for="key in STAT_KEYS"
          :key="key"
          class="char-sheet__save"
          :class="{ 'char-sheet__save--prof': hasProf(key) }"
        >
          <span class="char-sheet__save-dot" />
          <span class="char-sheet__save-val">{{ saveMod(key) }}</span>
          <span class="char-sheet__save-name">{{ SAVE_LABELS[key] }}</span>
        </div>
      </div>

    </template>
  </div>
</template>

<style scoped>
.char-sheet {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  padding: 0.75rem;
  gap: 0.6rem;
}

/* Empty / loading / error */
.char-sheet__empty,
.char-sheet__loading,
.char-sheet__error {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  text-align: center;
  color: var(--ss-text-muted);
  font-size: 0.8rem;
  padding: 1rem;
}

.char-sheet__empty-icon { font-size: 2rem; opacity: 0.3; margin-bottom: 0.25rem; }
.char-sheet__empty-hint { font-size: 0.72rem; opacity: 0.7; }
.char-sheet__error { color: var(--ss-danger, #ef4444); }
.char-sheet__error-hint { color: var(--ss-text-muted); font-size: 0.72rem; }

.char-sheet__retry {
  background: none;
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  cursor: pointer;
  color: var(--ss-primary);
  margin-top: 0.25rem;
}
.char-sheet__retry:hover { background: var(--ss-parchment-dark); }

/* Header */
.char-sheet__header {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
}

.char-sheet__avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--ss-border);
  flex-shrink: 0;
}

.char-sheet__avatar--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ss-parchment-dark);
  color: var(--ss-text-muted);
  font-size: 1.25rem;
}

.char-sheet__identity {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  min-width: 0;
}

.char-sheet__name {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--ss-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.char-sheet__class {
  font-size: 0.7rem;
  color: var(--ss-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.char-sheet__badges {
  display: flex;
  gap: 0.3rem;
  margin-top: 0.1rem;
  flex-wrap: wrap;
}

.char-sheet__badge {
  background: color-mix(in srgb, var(--ss-primary) 12%, transparent);
  color: var(--ss-primary);
  border-radius: 99px;
  padding: 0.05em 0.5em;
  font-size: 0.65rem;
  font-weight: 600;
}

/* Header action buttons (DnD Beyond link + refresh) */
.char-sheet__header-actions {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex-shrink: 0;
}

.char-sheet__ddb-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--ss-primary) 12%, transparent);
  color: var(--ss-primary);
  font-size: 0.7rem;
  text-decoration: none;
  border: 1px solid color-mix(in srgb, var(--ss-primary) 25%, transparent);
  transition: background 0.15s;
}
.char-sheet__ddb-link:hover { background: color-mix(in srgb, var(--ss-primary) 22%, transparent); }

.char-sheet__refresh {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: none;
  border: 1px solid var(--ss-border);
  border-radius: 4px;
  cursor: pointer;
  color: var(--ss-text-muted);
  font-size: 0.7rem;
  transition: color 0.15s;
}
.char-sheet__refresh:hover { color: var(--ss-primary); border-color: var(--ss-primary); }
.char-sheet__refresh--spinning .pi { animation: spin 1s linear infinite; }
.char-sheet__refresh:disabled { opacity: 0.5; cursor: not-allowed; }

@keyframes spin { to { transform: rotate(360deg); } }

/* Stale warning */
.char-sheet__stale {
  font-size: 0.68rem;
  color: var(--ss-warning, #f59e0b);
  display: flex;
  align-items: center;
  gap: 0.3rem;
  background: color-mix(in srgb, var(--ss-warning, #f59e0b) 10%, transparent);
  border-radius: var(--ss-radius);
  padding: 0.3rem 0.5rem;
}

/* AC · HP · Speed */
.char-sheet__vitals {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.4rem;
}

.char-sheet__vital {
  background: var(--ss-parchment-dark);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  padding: 0.35rem 0.4rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.08rem;
}

.char-sheet__vital-label {
  font-size: 0.58rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ss-text-muted);
}

.char-sheet__vital-value {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--ss-text);
  line-height: 1;
}

/* Ability scores */
.char-sheet__abilities {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.35rem;
}

.char-sheet__ability {
  background: var(--ss-parchment-dark);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  padding: 0.3rem 0.25rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.04rem;
}

.char-sheet__ability-label {
  font-size: 0.55rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ss-text-muted);
}

.char-sheet__ability-mod {
  font-size: 1rem;
  font-weight: 700;
  color: var(--ss-text);
  line-height: 1.1;
}

.char-sheet__ability-score {
  font-size: 0.62rem;
  color: var(--ss-text-muted);
}

/* Saving throws */
.char-sheet__section-title {
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--ss-text-muted);
  margin-bottom: -0.2rem;
}

.char-sheet__saves {
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
}

.char-sheet__save {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  color: var(--ss-text-muted);
  padding: 0.05rem 0;
}

.char-sheet__save-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid var(--ss-border);
  flex-shrink: 0;
  background: transparent;
}

.char-sheet__save--prof .char-sheet__save-dot {
  background: var(--ss-primary);
  border-color: var(--ss-primary);
}

.char-sheet__save--prof {
  color: var(--ss-text);
}

.char-sheet__save-val {
  font-weight: 600;
  min-width: 2.2ch;
  text-align: right;
  font-size: 0.73rem;
}

.char-sheet__save-name {
  font-size: 0.72rem;
}
</style>
