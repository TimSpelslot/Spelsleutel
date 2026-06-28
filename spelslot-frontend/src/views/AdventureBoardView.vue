<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Skeleton from 'primevue/skeleton'
import { sessionService, type SessionSummary, type SessionFilter, type SignUpStatus } from '@/services/sessionService'
import { useAuthStore } from '@/stores/auth'
import SessionFormDialog from '@/components/adventureboard/SessionFormDialog.vue'

const { t } = useI18n()
const router = useRouter()
const toast = useToast()
const auth = useAuthStore()

// ── State ─────────────────────────────────────────────────────────────────

const sessions = ref<SessionSummary[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const activeFilter = ref<SessionFilter>('upcoming')
const signingUpId = ref<string | null>(null)
const createDialogVisible = ref(false)

// ── Derived ───────────────────────────────────────────────────────────────

const isDmOrAdmin = computed(() => auth.hasPermission(['DM', 'ADMIN']))

const availableFilters = computed<Array<{ value: SessionFilter; label: string }>>(() => {
  const filters: Array<{ value: SessionFilter; label: string }> = [
    { value: 'upcoming', label: t('session.ab.filters.upcoming') },
    { value: 'mine', label: t('session.ab.filters.mine') },
  ]
  if (isDmOrAdmin.value) {
    filters.push({ value: 'dm', label: t('session.ab.filters.dm') })
  }
  return filters
})

const emptyMessage = computed(() => {
  if (activeFilter.value === 'mine') return t('session.ab.empty.mine')
  if (activeFilter.value === 'dm') return t('session.ab.empty.dm')
  return t('session.ab.empty.upcoming')
})

// ── Data fetching ─────────────────────────────────────────────────────────

async function loadSessions(filter: SessionFilter) {
  loading.value = true
  error.value = null
  const result = await sessionService.list(filter)
  loading.value = false
  if (result.type === 'ok') {
    sessions.value = result.data
  } else {
    error.value = result.message
    toast.add({ severity: 'error', summary: result.message, life: 5000 })
  }
}

async function selectFilter(filter: SessionFilter) {
  if (activeFilter.value === filter && !loading.value) return
  activeFilter.value = filter
  await loadSessions(filter)
}

onMounted(() => loadSessions('upcoming'))

// ── Sign-up actions ───────────────────────────────────────────────────────

async function handleSignUp(session: SessionSummary, event: Event) {
  event.stopPropagation()
  if (signingUpId.value) return

  signingUpId.value = session.id
  let result: Awaited<ReturnType<typeof sessionService.signUp | typeof sessionService.cancelSignUp>>

  if (session.mySignUp && session.mySignUp.status !== 'cancelled') {
    result = await sessionService.cancelSignUp(session.id)
    if (result.type === 'ok') {
      const s = sessions.value.find((x) => x.id === session.id)
      if (s) {
        s.mySignUp = null
        s.signupCount = Math.max(0, s.signupCount - 1)
        if (session.mySignUp?.status === 'assigned') {
          s.assignedCount = Math.max(0, s.assignedCount - 1)
        }
      }
      toast.add({ severity: 'success', summary: t('session.ab.card.cancel'), life: 3000 })
    } else {
      toast.add({ severity: 'error', summary: result.message, life: 5000 })
    }
  } else {
    result = await sessionService.signUp(session.id)
    if (result.type === 'ok') {
      const s = sessions.value.find((x) => x.id === session.id)
      if (s) {
        s.mySignUp = { id: result.data.id, status: result.data.status, appeared: false }
        s.signupCount += 1
      }
      toast.add({ severity: 'success', summary: t('session.ab.card.signUp'), life: 3000 })
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

// ── Navigation ────────────────────────────────────────────────────────────

function goToSession(id: string) {
  router.push({ name: 'session-detail', params: { id } })
}

// ── Formatting helpers ────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
}

function isFull(session: SessionSummary): boolean {
  return session.assignedCount >= session.maxPlayers
}

function capacityPercent(session: SessionSummary): number {
  if (session.maxPlayers === 0) return 0
  return Math.min(100, Math.round((session.assignedCount / session.maxPlayers) * 100))
}

function signUpLabel(session: SessionSummary): string {
  if (!session.mySignUp || session.mySignUp.status === 'cancelled') return t('session.ab.card.signUp')
  const map: Record<SignUpStatus, string> = {
    pending: t('session.ab.card.signed'),
    assigned: t('session.ab.card.assigned'),
    waitlist: t('session.ab.card.waitlist'),
    cancelled: t('session.ab.card.signUp'),
  }
  return map[session.mySignUp.status]
}

function isSignedUp(session: SessionSummary): boolean {
  return !!session.mySignUp && session.mySignUp.status !== 'cancelled'
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

function rankValue(session: SessionSummary, key: RankKey): number {
  if (key === 'combat') return session.rankCombat
  if (key === 'exploration') return session.rankExploration
  return session.rankRoleplaying
}
</script>

<template>
  <div class="ab-view">
    <!-- Header -->
    <div class="ab-header">
      <h1 class="ab-title">{{ t('session.ab.title') }}</h1>
      <Button
        v-if="isDmOrAdmin"
        :label="t('session.ab.create')"
        icon="pi pi-plus"
        @click="handleCreateSession"
      />
    </div>

    <!-- Filter tabs -->
    <div class="ab-filters" role="tablist">
      <button
        v-for="f in availableFilters"
        :key="f.value"
        role="tab"
        class="ab-filter-tab"
        :class="{ 'ab-filter-tab--active': activeFilter === f.value }"
        :aria-selected="activeFilter === f.value"
        @click="selectFilter(f.value)"
      >
        {{ f.label }}
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
      <p>{{ emptyMessage }}</p>
    </div>

    <!-- Create session dialog -->
    <SessionFormDialog
      v-model:visible="createDialogVisible"
      @saved="onSessionCreated"
    />

    <!-- Session grid -->
    <div v-else class="ab-grid">
      <article
        v-for="session in sessions"
        :key="session.id"
        class="ab-card"
        tabindex="0"
        role="button"
        :aria-label="session.title"
        @click="goToSession(session.id)"
        @keydown.enter="goToSession(session.id)"
        @keydown.space.prevent="goToSession(session.id)"
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
            <span class="ab-card-rank-label">{{ t(`session.ab.ranks.${key}`).slice(0, 3) }}</span>
            <div class="ab-card-rank-pips">
              <span
                v-for="pip in 3"
                :key="pip"
                class="ab-card-rank-pip"
                :class="{ 'ab-card-rank-pip--filled': pip <= rankValue(session, key) }"
              />
            </div>
          </div>
        </div>

        <!-- Tags + story badge -->
        <div class="ab-card-tags">
          <Tag
            v-if="session.isStoryAdventure"
            :value="t('session.ab.card.story')"
            severity="warn"
            icon="pi pi-book"
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

        <!-- Sign-up button (players only; session must be open) -->
        <div v-if="!isDmOrAdmin && session.status === 'open'" class="ab-card-actions" @click.stop>
          <Button
            :label="signUpLabel(session)"
            :icon="isSignedUp(session) ? 'pi pi-times' : 'pi pi-check'"
            :severity="isSignedUp(session) ? 'secondary' : 'primary'"
            size="small"
            :loading="signingUpId === session.id"
            @click="handleSignUp(session, $event)"
          />
        </div>
      </article>
    </div>
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
  margin-bottom: 1.5rem;
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
  gap: 0.75rem;
  margin-top: 0.25rem;
}

.ab-card-rank {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}

.ab-card-rank-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ss-text-subtle);
}

.ab-card-rank-pips {
  display: flex;
  gap: 2px;
}

.ab-card-rank-pip {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ss-border);
  transition: background 0.15s;
}

.ab-card-rank-pip--filled {
  background: var(--ss-primary);
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

/* ── Sign-up button ──────────────────────────────────────────────────────── */

.ab-card-actions {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--ss-border-subtle);
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
