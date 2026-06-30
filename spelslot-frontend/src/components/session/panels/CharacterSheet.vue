<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import { ddbService, type DdbCharacter } from '@/services/ddbService'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  characterId: string | null
}>()

const { t } = useI18n()

const character = ref<DdbCharacter | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const stale = ref(false)
const refreshing = ref(false)

const STAT_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
const STAT_LABELS: Record<string, string> = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA',
}
const SAVE_LABELS: Record<string, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
}

const classLabel = computed(() => {
  if (!character.value) return ''
  return character.value.classes
    .map((c) => `${c.name}${c.subclass ? ` (${c.subclass})` : ''} ${c.level}`)
    .join(' / ')
})

const ddbUrl = computed(() =>
  props.characterId ? `https://www.dndbeyond.com/characters/${props.characterId}` : null,
)

function fmtMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`
}

function saveMod(key: (typeof STAT_KEYS)[number]): string {
  if (!character.value) return ''
  const st = character.value.savingThrows?.[key]
  if (st != null) return fmtMod(st.total)
  // Fallback for cached data before savingThrows field was added
  const base = character.value.modifiers[key]
  const prof = character.value.savingThrowProficiencies?.includes(key)
    ? character.value.proficiencyBonus
    : 0
  return fmtMod(base + prof)
}

function hasProf(key: (typeof STAT_KEYS)[number]): boolean {
  return character.value?.savingThrows?.[key]?.proficient ??
    character.value?.savingThrowProficiencies?.includes(key) ??
    false
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
      <p>{{ t('session.characterSheet.noCharacterLinked') }}</p>
      <p class="char-sheet__empty-hint">
        {{ t('session.characterSheet.noCharacterHint') }}
      </p>
    </div>

    <!-- Loading -->
    <div v-else-if="loading" class="char-sheet__loading">
      <i class="pi pi-spin pi-spinner" /> {{ t('session.characterSheet.loadingCharacter') }}
    </div>

    <!-- Error -->
    <div v-else-if="error && !character" class="char-sheet__error">
      <i class="pi pi-exclamation-circle" />
      <p>{{ error }}</p>
      <p class="char-sheet__error-hint">
        {{ t('session.characterSheet.characterIdLabel', { id: characterId }) }}
      </p>
      <Button
        :label="t('session.characterSheet.retry')"
        severity="secondary"
        outlined
        size="small"
        class="char-sheet__retry"
        @click="load"
      />
    </div>

    <!-- Character data -->
    <template v-else-if="character">
      <!-- Header -->
      <div class="char-sheet__header">
        <Avatar
          :image="character.avatarUrl || undefined"
          :icon="character.avatarUrl ? undefined : 'pi pi-user'"
          shape="circle"
          size="large"
          class="char-sheet__avatar"
        />
        <div class="char-sheet__identity">
          <span class="char-sheet__name">{{ character.name }}</span>
          <span class="char-sheet__class">{{ classLabel }}</span>
          <div class="char-sheet__badges">
            <span class="char-sheet__badge">{{
              t('session.characterSheet.badges.level', { level: character.totalLevel })
            }}</span>
            <span class="char-sheet__badge">{{
              t('session.characterSheet.badges.proficiency', {
                bonus: fmtMod(character.proficiencyBonus),
              })
            }}</span>
          </div>
        </div>
        <div class="char-sheet__header-actions">
          <Button
            v-if="ddbUrl"
            as="a"
            :href="ddbUrl"
            target="_blank"
            rel="noopener noreferrer"
            icon="pi pi-external-link"
            severity="secondary"
            text
            rounded
            size="small"
            :title="t('session.characterSheet.openFullSheet')"
            :aria-label="t('session.characterSheet.openFullSheet')"
          />
          <Button
            icon="pi pi-refresh"
            severity="secondary"
            text
            rounded
            size="small"
            :loading="refreshing"
            :disabled="refreshing"
            :title="t('session.characterSheet.syncFromDdb')"
            :aria-label="t('session.characterSheet.syncFromDdb')"
            @click="refresh"
          />
        </div>
      </div>

      <!-- Stale warning -->
      <div v-if="stale" class="char-sheet__stale">
        <i class="pi pi-exclamation-triangle" /> {{ t('session.characterSheet.staleWarning') }}
      </div>

      <!-- AC · HP · Speed row -->
      <div class="char-sheet__vitals">
        <div class="char-sheet__vital">
          <span class="char-sheet__vital-label">{{ t('session.characterSheet.vitals.ac') }}</span>
          <span class="char-sheet__vital-value">{{ character.armorClass }}</span>
        </div>
        <div class="char-sheet__vital">
          <span class="char-sheet__vital-label">{{
            t('session.characterSheet.vitals.maxHp')
          }}</span>
          <span class="char-sheet__vital-value">{{ character.maxHp }}</span>
        </div>
        <div class="char-sheet__vital">
          <span class="char-sheet__vital-label">{{
            t('session.characterSheet.vitals.speed')
          }}</span>
          <span class="char-sheet__vital-value">{{
            t('session.characterSheet.vitals.speedValue', { speed: character.speed })
          }}</span>
        </div>
      </div>

      <!-- Ability scores -->
      <div class="char-sheet__abilities">
        <div v-for="key in STAT_KEYS" :key="key" class="char-sheet__ability">
          <span class="char-sheet__ability-label">{{ STAT_LABELS[key] }}</span>
          <span class="char-sheet__ability-mod">{{ fmtMod(character.modifiers[key]) }}</span>
          <span class="char-sheet__ability-score">{{ character.stats[key] }}</span>
        </div>
      </div>

      <!-- Saving throws -->
      <div class="char-sheet__section-title">{{ t('common.savingThrows') }}</div>
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

.char-sheet__empty-icon {
  font-size: 2rem;
  opacity: 0.3;
  margin-bottom: 0.25rem;
}
.char-sheet__empty-hint {
  font-size: 0.72rem;
  opacity: 0.7;
}
.char-sheet__error {
  color: var(--ss-danger, #ef4444);
}
.char-sheet__error-hint {
  color: var(--ss-text-muted);
  font-size: 0.72rem;
}

.char-sheet__retry {
  margin-top: 0.25rem;
}

/* Header */
.char-sheet__header {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
}

/* PrimeVue Avatar (size="large" = 48px) gets a brand border */
.char-sheet__avatar {
  border: 2px solid var(--ss-border);
  flex-shrink: 0;
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
