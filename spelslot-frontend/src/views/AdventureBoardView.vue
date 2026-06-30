<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Skeleton from 'primevue/skeleton'
import Avatar from 'primevue/avatar'
import { sessionService, type SessionSummary } from '@/services/sessionService'
import { instantModeService } from '@/services/instantModeService'
import { useAuthStore } from '@/stores/auth'
import SessionFormDialog from '@/components/adventureboard/SessionFormDialog.vue'
import SessionDetailDialog from '@/components/adventureboard/SessionDetailDialog.vue'
import combatIcon from '@/assets/spiked-dragon-head.svg'
import explorationIcon from '@/assets/dungeon-gate.svg'
import roleplayIcon from '@/assets/drama-masks.svg'

const { t } = useI18n()
const toast = useToast()
const auth = useAuthStore()

// ── State ─────────────────────────────────────────────────────────────────

const sessions = ref<SessionSummary[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const signingUpId = ref<string | null>(null)
const createDialogVisible = ref(false)
const detailDialogVisible = ref(false)
const selectedSessionId = ref<string | null>(null)
const isInstantMode = ref(false)

// Week navigation: ISO date string of the Monday for the displayed week
const currentWeekMonday = ref<string>(getUpcomingMonday())

// Track which priorities are already used this week: Set of 1 | 2 | 3
const usedPriorities = computed<Set<number>>(() => {
  const used = new Set<number>()
  for (const s of sessions.value) {
    if (s.mySignUp && s.mySignUp.status !== 'cancelled') {
      used.add(s.mySignUp.priority)
    }
  }
  return used
})

// ── Derived ───────────────────────────────────────────────────────────────

const weekLabel = computed(() => {
  const monday = new Date(currentWeekMonday.value)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  return `${fmt(monday)} – ${fmt(sunday)}`
})

// ── Week helpers ──────────────────────────────────────────────────────────

function getUpcomingMonday(): string {
  const today = new Date()
  const day = today.getDay() // 0=Sun
  const daysFromMon = day === 0 ? 6 : day - 1
  const thisMon = new Date(today)
  thisMon.setDate(today.getDate() - daysFromMon)
  thisMon.setHours(0, 0, 0, 0)
  const offset = day >= 1 && day <= 3 ? 0 : 7
  const result = new Date(thisMon)
  result.setDate(thisMon.getDate() + offset)
  return result.toISOString().slice(0, 10)
}

function shiftWeek(delta: number) {
  const d = new Date(currentWeekMonday.value)
  d.setDate(d.getDate() + delta * 7)
  currentWeekMonday.value = d.toISOString().slice(0, 10)
  loadSessions()
}

function goToCurrentWeek() {
  currentWeekMonday.value = getUpcomingMonday()
  loadSessions()
}

// ── Data fetching ─────────────────────────────────────────────────────────

async function loadSessions() {
  loading.value = true
  error.value = null
  const result = await sessionService.list('week', currentWeekMonday.value)
  loading.value = false
  if (result.type === 'ok') {
    sessions.value = result.data
  } else {
    error.value = result.message
    toast.add({ severity: 'error', summary: result.message, life: 5000 })
  }
}

onMounted(async () => {
  const [, instantResult] = await Promise.all([
    loadSessions(),
    instantModeService.check(),
  ])
  if (instantResult.type === 'ok') isInstantMode.value = instantResult.data
})

// ── Sign-up actions ───────────────────────────────────────────────────────

async function handleChoicePick(session: SessionSummary, choice: 1 | 2 | 3, event: Event) {
  event.stopPropagation()
  if (signingUpId.value) return
  signingUpId.value = session.id

  const currentPriority = session.mySignUp?.priority

  // Always POST — backend handles toggle-off (same session + same priority) internally
  // without a karma penalty. Never call cancelSignUp here; that DELETE route penalises
  // players who cancel an already-assigned slot.
  const result = await sessionService.signUp(session.id, choice)

  if (result.type === 'ok') {
    const s = sessions.value.find((x) => x.id === session.id)
    if (result.data === null) {
      // Backend toggled off: same session, same priority was already set
      if (s) { s.mySignUp = null; s.signupCount = Math.max(0, s.signupCount - 1) }
      toast.add({ severity: 'success', summary: 'Aanmelding verwijderd', life: 3000 })
    } else {
      if (s) {
        if (!currentPriority) s.signupCount += 1  // only increment when newly signing up for this session
        s.mySignUp = { id: result.data.id, status: result.data.status, priority: result.data.priority, appeared: false }
      }
      // Backend also cleared any other session that held this priority — mirror that locally
      for (const other of sessions.value) {
        if (other.id !== session.id && other.mySignUp?.priority === choice) {
          other.signupCount = Math.max(0, other.signupCount - 1)
          other.mySignUp = null
        }
      }
      toast.add({ severity: 'success', summary: `Keuze ${choice} ingesteld`, life: 3000 })
    }
  } else {
    toast.add({ severity: 'error', summary: result.message, life: 5000 })
  }

  signingUpId.value = null
}

async function handleInstantSignup(session: SessionSummary, event: Event) {
  event.stopPropagation()
  if (signingUpId.value) return
  signingUpId.value = session.id

  if (session.mySignUp) {
    const result = await sessionService.cancelSignUp(session.id)
    if (result.type === 'ok') {
      const s = sessions.value.find((x) => x.id === session.id)
      if (s) { s.mySignUp = null; s.signupCount = Math.max(0, s.signupCount - 1) }
      toast.add({ severity: 'success', summary: 'Aanmelding verwijderd', life: 3000 })
    } else {
      toast.add({ severity: 'error', summary: result.message, life: 5000 })
    }
  } else {
    const result = await sessionService.instantSignUp(session.id)
    if (result.type === 'ok') {
      const s = sessions.value.find((x) => x.id === session.id)
      if (s && result.data) {
        s.signupCount += 1
        s.mySignUp = { id: result.data.id, status: result.data.status, priority: result.data.priority, appeared: false }
      }
      toast.add({ severity: 'success', summary: 'Direct aangemeld!', life: 3000 })
    } else {
      toast.add({ severity: 'error', summary: result.message, life: 5000 })
    }
  }

  signingUpId.value = null
}

function handleCreateSession() {
  createDialogVisible.value = true
}

function onSessionCreated(session: SessionSummary) {
  sessions.value.unshift(session)
}

// ── Detail dialog ─────────────────────────────────────────────────────────

function openDetail(id: string) {
  selectedSessionId.value = id
  detailDialogVisible.value = true
}

function onDialogSignupChanged(
  sessionId: string,
  mySignUp: { id: string; status: string; priority: number; appeared: boolean } | null,
  delta: number,
) {
  const s = sessions.value.find((x) => x.id === sessionId)
  if (!s) return
  s.mySignUp = mySignUp as typeof s.mySignUp
  s.signupCount = Math.max(0, s.signupCount + delta)
  // If the dialog signed up with a priority, clear that priority from all other sessions
  if (mySignUp) {
    for (const other of sessions.value) {
      if (other.id !== sessionId && other.mySignUp?.priority === mySignUp.priority) {
        other.signupCount = Math.max(0, other.signupCount - 1)
        other.mySignUp = null
      }
    }
  }
}

function onDialogSessionUpdated(updated: import('@/services/sessionService').SessionSummary) {
  const s = sessions.value.find((x) => x.id === updated.id)
  if (!s) return
  s.title = updated.title
  s.shortDescription = updated.shortDescription
  s.date = updated.date
  s.maxPlayers = updated.maxPlayers
  s.tags = updated.tags
  s.isStoryAdventure = updated.isStoryAdventure
  s.excludeFromKarma = updated.excludeFromKarma
  s.rankCombat = updated.rankCombat
  s.rankExploration = updated.rankExploration
  s.rankRoleplaying = updated.rankRoleplaying
  s.status = updated.status
}

// ── Formatting helpers ────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
}

function isFull(session: SessionSummary): boolean {
  return session.assignedCount >= session.maxPlayers
}

function capacityPercent(session: SessionSummary): number {
  if (session.maxPlayers === 0) return 0
  return Math.min(100, Math.round((session.assignedCount / session.maxPlayers) * 100))
}

function statusSeverity(status: string): string {
  const map: Record<string, string> = {
    draft: 'secondary',
    open: 'success',
    confirmed: 'info',
    completed: 'contrast',
    cancelled: 'danger',
  }
  return map[status] ?? 'secondary'
}

const RANK_KEYS = ['combat', 'exploration', 'roleplay'] as const
type RankKey = (typeof RANK_KEYS)[number]

const RANK_ICONS: Record<RankKey, string> = {
  combat: combatIcon,
  exploration: explorationIcon,
  roleplay: roleplayIcon,
}

function rankValue(session: SessionSummary, key: RankKey): number {
  if (key === 'combat') return session.rankCombat
  if (key === 'exploration') return session.rankExploration
  return session.rankRoleplaying
}

function avatarLabel(name: string): string {
  return name.charAt(0).toUpperCase() || '?'
}
</script>

<template>
  <div class="ab-view">
    <!-- Header -->
    <div class="ab-header">
      <h1 class="ab-title">{{ t('session.ab.title') }}</h1>
      <Button
        :label="t('session.ab.create')"
        icon="pi pi-plus"
        @click="handleCreateSession"
      />
    </div>

    <!-- Instant mode banner -->
    <div v-if="isInstantMode" class="ab-instant-banner">
      <i class="pi pi-bolt" />
      <span>Instant aanmelden is actief — je wordt direct ingedeeld!</span>
    </div>

    <!-- Week navigation -->
    <div class="ab-week-nav">
      <button class="ab-week-btn" :disabled="loading" @click="shiftWeek(-1)">
        <i class="pi pi-chevron-left" />
      </button>
      <button class="ab-week-label" :disabled="loading" @click="goToCurrentWeek">
        {{ weekLabel }}
      </button>
      <button class="ab-week-btn" :disabled="loading" @click="shiftWeek(1)">
        <i class="pi pi-chevron-right" />
      </button>
    </div>

    <!-- Loading skeletons -->
    <div v-if="loading" class="ab-grid">
      <div v-for="n in 6" :key="n" class="ab-skeleton-card">
        <Skeleton height="1.25rem" class="ab-skeleton-row" />
        <Skeleton height="1rem" width="60%" class="ab-skeleton-row" />
        <Skeleton height="0.75rem" class="ab-skeleton-row" />
        <Skeleton height="2rem" width="40%" class="ab-skeleton-row" />
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="ab-error">
      <i class="pi pi-exclamation-triangle" />
      <span>{{ error }}</span>
    </div>

    <!-- Empty state -->
    <div v-else-if="sessions.length === 0" class="ab-empty">
      <i class="pi pi-calendar ab-empty-icon" />
      <p>{{ t('session.ab.empty.week') }}</p>
    </div>

    <!-- Session grid -->
    <div v-else class="ab-grid">
      <article
        v-for="session in sessions"
        :key="session.id"
        class="ab-card"
        tabindex="0"
        role="button"
        :aria-label="session.title"
        @click="openDetail(session.id)"
        @keydown.enter="openDetail(session.id)"
        @keydown.space.prevent="openDetail(session.id)"
      >
        <!-- Status badge (non-open only) -->
        <div v-if="session.status !== 'open'" class="ab-card-status-row">
          <Tag
            :value="t(`session.ab.status.${session.status}`)"
            :severity="statusSeverity(session.status)"
            class="ab-card-status"
          />
        </div>

        <!-- Date -->
        <p class="ab-card-date">{{ formatDate(session.date) }}</p>

        <!-- Title + description -->
        <h2 class="ab-card-title">{{ session.title }}</h2>
        <p v-if="session.shortDescription" class="ab-card-desc">{{ session.shortDescription }}</p>

        <!-- DM row -->
        <div v-if="session.dm" class="ab-card-dm">
          <div class="ab-card-avatar" :aria-hidden="true">
            <img
              v-if="session.dm.avatarUrl"
              :src="session.dm.avatarUrl"
              :alt="session.dm.displayName"
            />
            <span v-else class="ab-card-avatar-initial">{{ session.dm.displayName.charAt(0).toUpperCase() }}</span>
          </div>
          <span class="ab-card-dm-name">{{ session.dm.displayName }}</span>
        </div>

        <!-- Capacity bar -->
        <div class="ab-card-capacity">
          <div class="ab-card-capacity-bar" role="progressbar" :aria-valuenow="capacityPercent(session)" aria-valuemin="0" aria-valuemax="100">
            <div
              class="ab-card-capacity-fill"
              :class="{ 'ab-card-capacity-fill--full': isFull(session) }"
              :style="{ width: `${capacityPercent(session)}%` }"
            />
          </div>
          <span class="ab-card-capacity-label">
            <template v-if="isFull(session)">{{ t('session.ab.card.full') }}</template>
            <template v-else>{{ session.assignedCount }}/{{ session.maxPlayers }}</template>
          </span>
        </div>

        <!-- Rank pips -->
        <div class="ab-card-ranks">
          <div v-for="key in RANK_KEYS" :key="key" class="ab-card-rank" :title="t(`session.ab.ranks.${key}`)">
            <img
              v-for="pip in 3"
              :key="pip"
              :src="RANK_ICONS[key]"
              class="ab-card-rank-pip"
              :class="pip <= rankValue(session, key) ? 'ab-card-rank-pip--on' : 'ab-card-rank-pip--off'"
              :alt="pip === 1 ? t(`session.ab.ranks.${key}`) : ''"
            />
          </div>
        </div>

        <!-- Tags + story badge + series -->
        <div class="ab-card-tags">
          <Tag
            v-if="session.isStoryAdventure"
            :value="t('session.ab.card.story')"
            severity="warn"
            icon="pi pi-book"
            class="ab-tag"
          />
          <Tag
            v-if="session.numSessions > 1"
            :value="`Deel ${session.sessionNumber}/${session.numSessions}`"
            severity="info"
            icon="pi pi-link"
            class="ab-tag"
          />
          <Tag
            v-for="tag in session.tags"
            :key="tag"
            :value="tag"
            severity="secondary"
            class="ab-tag"
          />
        </div>

        <!-- Assigned room -->
        <div v-if="session.assignedRoom" class="ab-card-room">
          <i class="pi pi-map-marker ab-card-room-icon" />
          <span>{{ session.assignedRoom }}</span>
        </div>

        <!-- Assigned players (shown after release or for DM/admin) -->
        <div v-if="session.assignedPlayers && session.assignedPlayers.length > 0" class="ab-card-players" @click.stop>
          <div class="ab-card-players-label">
            <i class="pi pi-users" />
            <span>{{ session.assignedPlayers.length }} spelers</span>
          </div>
          <div class="ab-card-players-list">
            <div
              v-for="player in session.assignedPlayers.slice(0, 6)"
              :key="player.userId"
              class="ab-card-player"
              :title="player.displayName"
            >
              <Avatar
                :image="player.avatarUrl ?? undefined"
                :label="player.avatarUrl ? undefined : avatarLabel(player.displayName)"
                shape="circle"
                size="small"
                class="ab-card-player-avatar"
              />
            </div>
            <span v-if="session.assignedPlayers.length > 6" class="ab-card-players-more">
              +{{ session.assignedPlayers.length - 6 }}
            </span>
          </div>
        </div>

        <!-- Signup actions (hidden from session owner; session must be open) -->
        <div v-if="session.dm?.uid !== auth.user?.uid && session.status === 'open'" class="ab-card-actions" @click.stop>
          <!-- Instant mode: single toggle button -->
          <template v-if="isInstantMode">
            <button
              class="ab-instant-btn"
              :class="{ 'ab-instant-btn--active': !!session.mySignUp }"
              :disabled="signingUpId === session.id"
              @click="handleInstantSignup(session, $event)"
            >
              <i class="pi" :class="session.mySignUp ? 'pi-check' : 'pi-bolt'" />
              {{ session.mySignUp ? 'Afmelden' : 'Aanmelden' }}
            </button>
          </template>
          <!-- Normal mode: priority picker -->
          <template v-else>
            <div class="ab-choice-picker">
              <button
                v-for="choice in ([1, 2, 3] as const)"
                :key="choice"
                class="ab-choice-btn"
                :class="{
                  'ab-choice-btn--active': session.mySignUp?.priority === choice,
                  'ab-choice-btn--taken': usedPriorities.has(choice) && session.mySignUp?.priority !== choice,
                }"
                :disabled="signingUpId === session.id || (usedPriorities.has(choice) && session.mySignUp?.priority !== choice)"
                :title="usedPriorities.has(choice) && session.mySignUp?.priority !== choice ? `Keuze ${choice} al gebruikt` : `Aanmelden als keuze ${choice}`"
                @click="handleChoicePick(session, choice, $event)"
              >
                {{ choice }}e keuze
              </button>
            </div>
          </template>
        </div>
      </article>
    </div>

    <!-- Create session dialog -->
    <SessionFormDialog
      v-model:visible="createDialogVisible"
      @saved="onSessionCreated"
    />

    <!-- Session detail dialog -->
    <SessionDetailDialog
      v-model:visible="detailDialogVisible"
      :session-id="selectedSessionId"
      @signup-changed="onDialogSignupChanged"
      @session-updated="onDialogSessionUpdated"
    />
  </div>
</template>

<style scoped>
.ab-view {
  padding: 1.5rem;
  max-width: 1280px;
  margin: 0 auto;
}

/* ── Header ──────────────────────────────────────────────────────────────── */

.ab-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.ab-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--ss-text);
  margin: 0;
}

/* ── Filter tabs ─────────────────────────────────────────────────────────── */

.ab-filters {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
  border-bottom: 1px solid var(--ss-border);
}

.ab-filter-tab {
  padding: 0.5rem 1rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--ss-text-muted);
  transition: color 0.15s, border-color 0.15s;
}

.ab-filter-tab:hover {
  color: var(--ss-text);
}

.ab-filter-tab--active {
  color: var(--ss-primary);
  border-bottom-color: var(--ss-primary);
}

/* ── Week navigation ─────────────────────────────────────────────────────── */

.ab-week-nav {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-bottom: 1.25rem;
}

.ab-week-btn {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius-sm);
  color: var(--ss-text-muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
}

.ab-week-btn:hover:not(:disabled) {
  background: var(--ss-surface-raised);
  color: var(--ss-primary);
}

.ab-week-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.ab-week-label {
  flex: 1;
  max-width: 220px;
  padding: 0.35rem 0.75rem;
  background: none;
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius-sm);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ss-text);
  cursor: pointer;
  text-align: center;
  transition: background 0.15s;
}

.ab-week-label:hover:not(:disabled) {
  background: var(--ss-surface-raised);
}

/* ── Session grid ────────────────────────────────────────────────────────── */

.ab-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

/* ── Session card ────────────────────────────────────────────────────────── */

.ab-card {
  background: var(--ss-surface-raised);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  padding: 1rem;
  cursor: pointer;
  transition: box-shadow 0.15s, border-color 0.15s;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ab-card:hover,
.ab-card:focus-visible {
  box-shadow: var(--ss-shadow);
  border-color: var(--ss-primary);
  outline: none;
}

.ab-card-status-row {
  display: flex;
}

.ab-card-status {
  font-size: 0.75rem;
}

.ab-card-date {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ss-primary);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.ab-card-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--ss-text);
  margin: 0;
  line-height: 1.3;
}

.ab-card-desc {
  font-size: 0.82rem;
  color: var(--ss-text-muted);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── DM row ──────────────────────────────────────────────────────────────── */

.ab-card-dm {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.ab-card-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--ss-parchment-dark);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ab-card-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ab-card-avatar-initial {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--ss-text-muted);
}

.ab-card-dm-name {
  font-size: 0.8rem;
  color: var(--ss-text-muted);
}

/* ── Capacity bar ────────────────────────────────────────────────────────── */

.ab-card-capacity {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.ab-card-capacity-bar {
  flex: 1;
  height: 6px;
  background: var(--ss-border);
  border-radius: 3px;
  overflow: hidden;
}

.ab-card-capacity-fill {
  height: 100%;
  background: var(--ss-warning);
  border-radius: 3px;
  transition: width 0.3s;
}

.ab-card-capacity-fill--full {
  background: var(--ss-success);
}

.ab-card-capacity-label {
  font-size: 0.75rem;
  color: var(--ss-text-muted);
  white-space: nowrap;
}

/* ── Rank pips ───────────────────────────────────────────────────────────── */

.ab-card-ranks {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.ab-card-rank {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 2px;
}

.ab-card-rank-pip {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.ab-card-rank-pip--on {
  color: var(--ss-primary);
  opacity: 1;
}

.ab-card-rank-pip--off {
  color: var(--ss-text-subtle);
  opacity: 0.25;
}

/* ── Tags ────────────────────────────────────────────────────────────────── */

.ab-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: auto;
  padding-top: 0.25rem;
}

.ab-tag {
  font-size: 0.7rem;
}

/* ── Room indicator ──────────────────────────────────────────────────────── */

.ab-card-room {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.78rem;
  color: var(--ss-text-muted);
  margin-top: 0.25rem;
}

.ab-card-room-icon {
  font-size: 0.7rem;
  color: var(--ss-primary);
}

/* ── Assigned players ────────────────────────────────────────────────────── */

.ab-card-players {
  border-top: 1px solid var(--ss-border-subtle);
  padding-top: 0.5rem;
  margin-top: 0.25rem;
}

.ab-card-players-label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.72rem;
  color: var(--ss-text-muted);
  margin-bottom: 0.35rem;
}

.ab-card-players-list {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  flex-wrap: wrap;
}

.ab-card-player {
  flex-shrink: 0;
}

.ab-card-player-avatar {
  width: 24px !important;
  height: 24px !important;
  font-size: 0.65rem !important;
}

.ab-card-players-more {
  font-size: 0.72rem;
  color: var(--ss-text-muted);
  margin-left: 0.2rem;
}

/* ── Choice picker ───────────────────────────────────────────────────────── */

.ab-card-actions {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--ss-border-subtle);
}

.ab-choice-picker {
  display: flex;
  gap: 0.3rem;
  align-items: center;
  flex-wrap: wrap;
}

.ab-choice-btn {
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  border: 1.5px solid var(--ss-border);
  background: transparent;
  color: var(--ss-text-muted);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}

.ab-choice-btn:hover:not(:disabled) {
  border-color: var(--ss-primary);
  color: var(--ss-primary);
}

.ab-choice-btn--active {
  background: var(--ss-primary);
  border-color: var(--ss-primary);
  color: var(--ss-primary-fg);
}

.ab-choice-btn--active:hover:not(:disabled) {
  background: color-mix(in srgb, var(--ss-primary) 85%, black);
  color: var(--ss-primary-fg);
}

.ab-choice-btn--taken,
.ab-choice-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* ── Instant mode ────────────────────────────────────────────────────────── */

.ab-instant-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  margin-bottom: 1rem;
  background: color-mix(in srgb, var(--ss-primary) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--ss-primary) 40%, transparent);
  border-radius: var(--ss-radius);
  color: var(--ss-primary);
  font-size: 0.9rem;
  font-weight: 600;
}

.ab-instant-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.85rem;
  border-radius: var(--ss-radius);
  border: 2px solid var(--ss-border);
  background: transparent;
  color: var(--ss-text-muted);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}

.ab-instant-btn:hover:not(:disabled) {
  border-color: var(--ss-primary);
  color: var(--ss-primary);
}

.ab-instant-btn--active {
  background: var(--ss-primary);
  border-color: var(--ss-primary);
  color: var(--ss-primary-fg);
}

.ab-instant-btn--active:hover:not(:disabled) {
  background: color-mix(in srgb, var(--ss-primary) 85%, black);
}

.ab-instant-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ── Skeleton cards ──────────────────────────────────────────────────────── */

.ab-skeleton-card {
  background: var(--ss-surface-raised);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.ab-skeleton-row {
  border-radius: var(--ss-radius-sm);
}

/* ── Empty / Error ───────────────────────────────────────────────────────── */

.ab-empty,
.ab-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 4rem 2rem;
  color: var(--ss-text-muted);
  text-align: center;
}

.ab-empty-icon {
  font-size: 2.5rem;
  color: var(--ss-border);
}

.ab-error {
  color: var(--ss-danger);
}

/* ── Responsive ──────────────────────────────────────────────────────────── */

@media (max-width: 767px) {
  .ab-view {
    padding: 1rem;
  }

  .ab-grid {
    grid-template-columns: 1fr;
  }

  .ab-title {
    font-size: 1.25rem;
  }
}
</style>
