<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import InputNumber from 'primevue/inputnumber'
import ToggleSwitch from 'primevue/toggleswitch'
import Button from 'primevue/button'
import Select from 'primevue/select'
import { sessionService, type SessionSummary } from '@/services/sessionService'
import { roomService } from '@/services/roomService'
import combatIcon from '@/assets/spiked-dragon-head.svg'
import explorationIcon from '@/assets/dungeon-gate.svg'
import roleplayIcon from '@/assets/drama-masks.svg'

// ── Props & emits ──────────────────────────────────────────────────────────

const props = defineProps<{
  visible: boolean
  session?: SessionSummary | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  saved: [session: SessionSummary]
}>()

// ── i18n / toast ───────────────────────────────────────────────────────────

const { t } = useI18n()
const toast = useToast()

// ── Form state ─────────────────────────────────────────────────────────────

const title = ref('')
const shortDescription = ref('')
const date = ref('')
const maxPlayers = ref(5)
const tags = ref<string[]>([])
const tagInput = ref('')
const isStoryAdventure = ref(false)
const excludeFromKarma = ref(false)
const rankCombat = ref(1)
const rankExploration = ref(1)
const rankRoleplaying = ref(1)
const requestedRoom = ref<string | null>(null)
const availableRooms = ref<Array<{ label: string; value: string | null }>>([
  { label: '— Geen voorkeur —', value: null },
])

onMounted(async () => {
  const result = await roomService.list()
  if (result.type === 'ok') {
    availableRooms.value = [
      { label: '— Geen voorkeur —', value: null },
      ...result.data.filter(r => r.isActive).map(r => ({ label: r.name, value: r.name })),
    ]
  }
})

// Multi-session adventure (backend creates the full chain automatically)
const isMultiSession = ref(false)
const numSessions = ref(2)

const saving = ref(false)
const validationError = ref<string | null>(null)
const serverError = ref<string | null>(null)

// ── Derived ────────────────────────────────────────────────────────────────

const isEditMode = computed(() => !!props.session)

const dialogHeader = computed(() =>
  isEditMode.value ? t('session.ab.form.editTitle') : t('session.ab.form.createTitle'),
)

// ── Populate form when session changes ────────────────────────────────────

function populateForm(session: SessionSummary) {
  title.value = session.title
  shortDescription.value = session.shortDescription ?? ''
  const d = new Date(session.date)
  const pad = (n: number) => String(n).padStart(2, '0')
  date.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  maxPlayers.value = session.maxPlayers
  tags.value = [...session.tags]
  isStoryAdventure.value = session.isStoryAdventure
  excludeFromKarma.value = session.excludeFromKarma
  rankCombat.value = session.rankCombat
  rankExploration.value = session.rankExploration
  rankRoleplaying.value = session.rankRoleplaying
  requestedRoom.value = session.requestedRoom ?? null
  isMultiSession.value = session.numSessions > 1
  numSessions.value = session.numSessions > 1 ? session.numSessions : 2
}

function resetForm() {
  title.value = ''
  shortDescription.value = ''
  date.value = ''
  maxPlayers.value = 5
  tags.value = []
  tagInput.value = ''
  isStoryAdventure.value = false
  excludeFromKarma.value = false
  rankCombat.value = 1
  rankExploration.value = 1
  rankRoleplaying.value = 1
  requestedRoom.value = null
  isMultiSession.value = false
  numSessions.value = 2
  validationError.value = null
  serverError.value = null
}

watch(
  () => props.visible,
  (open) => {
    if (open) {
      if (props.session) {
        populateForm(props.session)
      } else {
        resetForm()
      }
    }
  },
  { immediate: true },
)

// ── Tag chip management ────────────────────────────────────────────────────

function addTag() {
  const val = tagInput.value.trim()
  if (val && !tags.value.includes(val)) {
    tags.value.push(val)
  }
  tagInput.value = ''
}

function removeTag(tag: string) {
  tags.value = tags.value.filter((t) => t !== tag)
}

function onTagKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    addTag()
  }
}

// ── Rank pip helpers ───────────────────────────────────────────────────────

function setRank(rank: 'combat' | 'exploration' | 'roleplaying', value: number) {
  if (rank === 'combat') rankCombat.value = value
  else if (rank === 'exploration') rankExploration.value = value
  else rankRoleplaying.value = value
}

function getRank(rank: 'combat' | 'exploration' | 'roleplaying'): number {
  if (rank === 'combat') return rankCombat.value
  if (rank === 'exploration') return rankExploration.value
  return rankRoleplaying.value
}

const RANK_OPTIONS = [
  { key: 'combat' as const, label: 'session.ab.form.rankCombat', icon: combatIcon },
  { key: 'exploration' as const, label: 'session.ab.form.rankExploration', icon: explorationIcon },
  { key: 'roleplaying' as const, label: 'session.ab.form.rankRoleplay', icon: roleplayIcon },
]

// ── Submit ─────────────────────────────────────────────────────────────────

async function handleSubmit() {
  if (saving.value) return

  validationError.value = null
  serverError.value = null

  if (!title.value.trim()) {
    validationError.value = t('session.ab.form.titleField') + ' is required.'
    return
  }
  if (!date.value) {
    validationError.value = t('session.ab.form.date') + ' is required.'
    return
  }

  saving.value = true

  const payload = {
    title: title.value.trim(),
    shortDescription: shortDescription.value.trim(),
    date: new Date(date.value).toISOString(),
    maxPlayers: maxPlayers.value,
    tags: tags.value,
    isStoryAdventure: isStoryAdventure.value,
    excludeFromKarma: excludeFromKarma.value,
    rankCombat: rankCombat.value,
    rankExploration: rankExploration.value,
    rankRoleplaying: rankRoleplaying.value,
    requestedRoom: requestedRoom.value || null,
    numSessions: isMultiSession.value ? numSessions.value : 1,
  }

  let result: Awaited<ReturnType<typeof sessionService.create | typeof sessionService.update>>

  if (isEditMode.value && props.session) {
    result = await sessionService.update(props.session.id, payload)
  } else {
    result = await sessionService.create(payload)
  }

  saving.value = false

  if (result.type === 'ok') {
    toast.add({ severity: 'success', summary: dialogHeader.value, life: 3000 })
    emit('saved', result.data)
    emit('update:visible', false)
  } else {
    serverError.value = result.message
    toast.add({ severity: 'error', summary: result.message, life: 5000 })
  }
}

function handleCancel() {
  emit('update:visible', false)
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :header="dialogHeader"
    :style="{ width: '540px', maxWidth: '95vw' }"
    :draggable="false"
    @update:visible="emit('update:visible', $event)"
  >
    <form class="sf-form" @submit.prevent="handleSubmit">
      <!-- Validation / server error -->
      <div v-if="validationError || serverError" class="sf-form-error" role="alert">
        <i class="pi pi-exclamation-triangle" />
        {{ validationError ?? serverError }}
      </div>

      <!-- Title -->
      <div class="sf-field">
        <label class="sf-label sf-label--required" for="sf-title">
          {{ t('session.ab.form.titleField') }}
        </label>
        <InputText
          id="sf-title"
          v-model="title"
          class="sf-input"
          :invalid="!!(validationError && !title.trim())"
          maxlength="120"
          autocomplete="off"
        />
      </div>

      <!-- Short description -->
      <div class="sf-field">
        <label class="sf-label" for="sf-desc">{{ t('session.ab.form.description') }}</label>
        <Textarea
          id="sf-desc"
          v-model="shortDescription"
          class="sf-input"
          :rows="2"
          maxlength="300"
          auto-resize
        />
      </div>

      <!-- Date -->
      <div class="sf-field">
        <label class="sf-label sf-label--required" for="sf-date">
          {{ t('session.ab.form.date') }}
        </label>
        <input
          id="sf-date"
          v-model="date"
          type="datetime-local"
          class="sf-datetime"
          :class="{ 'sf-datetime--invalid': !!(validationError && !date) }"
        />
      </div>

      <!-- Max players -->
      <div class="sf-field">
        <label class="sf-label" for="sf-max-players">{{ t('session.ab.form.maxPlayers') }}</label>
        <InputNumber
          id="sf-max-players"
          v-model="maxPlayers"
          :min="1"
          :max="20"
          :show-buttons="true"
          class="sf-input-number"
        />
      </div>

      <!-- Tags -->
      <div class="sf-field">
        <label class="sf-label" for="sf-tags">{{ t('session.ab.form.tags') }}</label>
        <div class="sf-tag-area">
          <div v-if="tags.length > 0" class="sf-tag-chips">
            <span v-for="tag in tags" :key="tag" class="sf-chip">
              {{ tag }}
              <button
                type="button"
                class="sf-chip-remove"
                :aria-label="`Remove ${tag}`"
                @click="removeTag(tag)"
              >
                <i class="pi pi-times" />
              </button>
            </span>
          </div>
          <InputText
            id="sf-tags"
            v-model="tagInput"
            class="sf-input sf-tag-input"
            :placeholder="t('session.ab.form.tagsHint')"
            maxlength="40"
            @keydown="onTagKeydown"
            @blur="addTag"
          />
        </div>
      </div>

      <!-- Room request -->
      <div class="sf-field">
        <label class="sf-label" for="sf-room">Ruimte voorkeur</label>
        <Select
          id="sf-room"
          v-model="requestedRoom"
          :options="availableRooms"
          option-label="label"
          option-value="value"
          class="sf-input"
          placeholder="Geen voorkeur"
        />
      </div>

      <!-- Toggles row -->
      <div class="sf-toggles-row">
        <div class="sf-toggle-item">
          <ToggleSwitch
            v-model="isStoryAdventure"
            input-id="sf-story"
          />
          <label for="sf-story" class="sf-toggle-label">
            {{ t('session.ab.form.storyAdventure') }}
          </label>
        </div>
        <div class="sf-toggle-item">
          <ToggleSwitch
            v-model="excludeFromKarma"
            input-id="sf-karma"
          />
          <label for="sf-karma" class="sf-toggle-label">
            {{ t('session.ab.form.excludeKarma') }}
          </label>
        </div>
      </div>

      <!-- Ranks -->
      <div class="sf-field">
        <p class="sf-label">{{ t('session.ab.form.ranks') }}</p>
        <div class="sf-ranks">
          <div
            v-for="rank in RANK_OPTIONS"
            :key="rank.key"
            class="sf-rank"
          >
            <span class="sf-rank-label">{{ t(rank.label) }}</span>
            <div class="sf-rank-pips" role="group" :aria-label="t(rank.label)">
              <button
                v-for="pip in 3"
                :key="pip"
                type="button"
                class="sf-rank-pip"
                :class="pip <= getRank(rank.key) ? 'sf-rank-pip--on' : 'sf-rank-pip--off'"
                :aria-label="`${t(rank.label)} ${pip}`"
                :aria-pressed="pip <= getRank(rank.key)"
                @click="setRank(rank.key, pip)"
              >
                <img :src="rank.icon" :alt="''" class="sf-rank-pip-icon" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Multi-session adventure -->
      <div class="sf-section sf-section--series">
        <div class="sf-section-header">
          <div class="sf-toggle-item">
            <ToggleSwitch v-model="isMultiSession" input-id="sf-series" />
            <label for="sf-series" class="sf-toggle-label sf-toggle-label--em">
              Meerdelig avontuur
            </label>
          </div>
        </div>

        <Transition name="sf-expand">
          <div v-if="isMultiSession" class="sf-series-fields">
            <div class="sf-field sf-field--sm">
              <label class="sf-label" for="sf-num-sessions">Aantal sessies</label>
              <InputNumber
                id="sf-num-sessions"
                v-model="numSessions"
                :min="2"
                :max="4"
                :show-buttons="true"
                class="sf-input-number sf-input-number--sm"
              />
            </div>
            <span class="sf-hint">Alle sessies worden automatisch aangemaakt, één week na elkaar. Spelers die de vorige sessie hebben gespeeld krijgen voorrang.</span>
          </div>
        </Transition>
      </div>
    </form>

    <!-- Footer -->
    <template #footer>
      <Button
        :label="t('session.ab.form.cancel')"
        severity="secondary"
        text
        :disabled="saving"
        @click="handleCancel"
      />
      <Button
        :label="t('session.ab.form.save')"
        icon="pi pi-check"
        :loading="saving"
        @click="handleSubmit"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.sf-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.25rem 0;
}

/* ── Form error ──────────────────────────────────────────────────────────── */

.sf-form-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  border-radius: var(--ss-radius-sm);
  background: color-mix(in srgb, var(--ss-danger) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--ss-danger) 30%, transparent);
  color: var(--ss-danger);
  font-size: 0.85rem;
}

/* ── Fields ──────────────────────────────────────────────────────────────── */

.sf-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.sf-field--sm {
  flex: 0 0 auto;
}

.sf-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ss-text);
  margin: 0;
}

.sf-label--required::after {
  content: ' *';
  color: var(--ss-danger);
}

.sf-hint {
  font-size: 0.78rem;
  color: var(--ss-text-muted);
}

.sf-input {
  width: 100%;
}

.sf-input-number {
  width: 10rem;
}

.sf-input-number--sm {
  width: 7rem;
}

/* ── Datetime input ──────────────────────────────────────────────────────── */

.sf-datetime {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius-sm);
  background: var(--ss-surface);
  color: var(--ss-text);
  font-size: 0.9rem;
  font-family: inherit;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.sf-datetime:focus {
  outline: none;
  border-color: var(--ss-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--ss-primary) 20%, transparent);
}

.sf-datetime--invalid {
  border-color: var(--ss-danger);
}

/* ── Tag chips ───────────────────────────────────────────────────────────── */

.sf-tag-area {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.sf-tag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.sf-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: color-mix(in srgb, var(--ss-primary) 12%, transparent);
  color: var(--ss-primary);
  border: 1px solid color-mix(in srgb, var(--ss-primary) 25%, transparent);
  border-radius: 99px;
  padding: 0.15rem 0.5rem;
  font-size: 0.78rem;
  font-weight: 500;
}

.sf-chip-remove {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: inherit;
  display: flex;
  align-items: center;
  opacity: 0.7;
  transition: opacity 0.1s;
  line-height: 1;
}

.sf-chip-remove:hover {
  opacity: 1;
}

.sf-chip-remove .pi {
  font-size: 0.6rem;
}

.sf-tag-input {
  width: 100%;
}

/* ── Toggles ─────────────────────────────────────────────────────────────── */

.sf-toggles-row {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.sf-toggle-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sf-toggle-label {
  font-size: 0.85rem;
  color: var(--ss-text);
  cursor: pointer;
}

.sf-toggle-label--em {
  font-weight: 600;
}

/* ── Rank pips ───────────────────────────────────────────────────────────── */

.sf-ranks {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
}

.sf-rank {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  align-items: center;
}

.sf-rank-label {
  font-size: 0.72rem;
  color: var(--ss-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.sf-rank-pips {
  display: flex;
  gap: 4px;
}

.sf-rank-pip {
  width: 28px;
  height: 28px;
  border-radius: var(--ss-radius-sm);
  border: 2px solid transparent;
  background: transparent;
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s, border-color 0.15s;
}

.sf-rank-pip-icon {
  width: 100%;
  height: 100%;
  display: block;
}

.sf-rank-pip--on {
  color: var(--ss-primary);
  opacity: 1;
}

.sf-rank-pip--off {
  color: var(--ss-text-subtle);
  opacity: 0.25;
}

.sf-rank-pip:hover {
  border-color: var(--ss-primary);
  opacity: 1;
}

/* ── Series section ──────────────────────────────────────────────────────── */

.sf-section--series {
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius-sm);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.sf-section-header {
  display: flex;
  align-items: center;
}

.sf-series-fields {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--ss-border);
}

.sf-series-row {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.sf-series-of {
  font-size: 0.9rem;
  color: var(--ss-text-muted);
  padding-bottom: 0.45rem;
}

/* ── Expand transition ───────────────────────────────────────────────────── */

.sf-expand-enter-active,
.sf-expand-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.sf-expand-enter-from,
.sf-expand-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
