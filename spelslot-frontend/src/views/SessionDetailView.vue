<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Skeleton from 'primevue/skeleton'
import Checkbox from 'primevue/checkbox'
import ToggleSwitch from 'primevue/toggleswitch'
import {
  sessionService,
  type SessionDetail,
  type SessionPlayer,
  type SessionSummary,
  type SignUpStatus,
} from '@/services/sessionService'
import { useAuthStore } from '@/stores/auth'
import SessionFormDialog from '@/components/adventureboard/SessionFormDialog.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const auth = useAuthStore()

// ── State ─────────────────────────────────────────────────────────────────

const session = ref<SessionDetail | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const editDialogVisible = ref(false)
const signingUp = ref(false)
const updatingStatus = ref(false)
const savingAssignments = ref(false)
const savingAttendance = ref(false)
const savingRelease = ref(false)

// Tracks optimistic assignment changes before saving
const pendingAssignments = ref<Map<string, SignUpStatus>>(new Map())
// Tracks attendance checkboxes
const pendingAttendance = ref<Map<string, boolean>>(new Map())

// ── Derived ───────────────────────────────────────────────────────────────

const sessionId = computed(() => route.params.id as string)

const isDmOrAdmin = computed(() => auth.hasPermission(['DM', 'ADMIN']))

const isSessionOwner = computed(() => {
  if (!session.value?.dm) return false
  return auth.hasPermission(['ADMIN']) || session.value.dm.uid === auth.user?.uid
})

const canManage = computed(() => isSessionOwner.value || auth.hasPermission('ADMIN'))

const canSignUp = computed(() => {
  if (!session.value) return false
  return session.value.status === 'open' && !isDmOrAdmin.value
})

const signedUp = computed(() => {
  const su = session.value?.mySignUp
  return !!su && su.status !== 'cancelled'
})

const visibleSignups = computed((): SessionPlayer[] => {
  if (!session.value) return []
  const signups = [...session.value.signups].sort((a, b) => a.priority - b.priority)
  if (isDmOrAdmin.value || isSessionOwner.value) return signups
  if (session.value.releaseAssignments) {
    return signups.filter((s) => s.status === 'assigned')
  }
  return []
})

const assignmentsReleased = computed(() => session.value?.releaseAssignments ?? false)

const canMarkAttendance = computed(() => {
  const s = session.value?.status
  return canManage.value && (s === 'confirmed' || s === 'completed')
})

const assignedSignups = computed(() =>
  session.value?.signups.filter((s) => s.status === 'assigned') ?? [],
)

// ── Data fetching ─────────────────────────────────────────────────────────

async function loadSession() {
  loading.value = true
  error.value = null
  const result = await sessionService.get(sessionId.value)
  loading.value = false
  if (result.type === 'ok') {
    session.value = result.data
    initPendingState(result.data)
  } else {
    error.value = result.message
    toast.add({ severity: 'error', summary: result.message, life: 5000 })
  }
}

function initPendingState(detail: SessionDetail) {
  const assignMap = new Map<string, SignUpStatus>()
  const attendMap = new Map<string, boolean>()
  for (const su of detail.signups) {
    assignMap.set(su.signUpId, su.status)
    attendMap.set(su.signUpId, su.appeared)
  }
  pendingAssignments.value = assignMap
  pendingAttendance.value = attendMap
}

onMounted(loadSession)

// ── Edit session ──────────────────────────────────────────────────────────

// SessionFormDialog expects SessionSummary; build it from the full SessionDetail
const sessionAsSummary = computed((): SessionSummary | null => {
  if (!session.value) return null
  const s = session.value
  return {
    id: s.id,
    title: s.title,
    shortDescription: s.shortDescription,
    date: s.date,
    dm: s.dm,
    maxPlayers: s.maxPlayers,
    status: s.status,
    tags: s.tags,
    isStoryAdventure: s.isStoryAdventure,
    excludeFromKarma: s.excludeFromKarma,
    rankCombat: s.rankCombat,
    rankExploration: s.rankExploration,
    rankRoleplaying: s.rankRoleplaying,
    releaseAssignments: s.releaseAssignments,
    signupCount: s.signups.length,
    assignedCount: s.signups.filter((su) => su.status === 'assigned').length,
    mySignUp: s.mySignUp,
  }
})

function onSessionEdited(updated: SessionSummary) {
  if (!session.value) return
  session.value.title = updated.title
  session.value.shortDescription = updated.shortDescription
  session.value.date = updated.date
  session.value.maxPlayers = updated.maxPlayers
  session.value.tags = updated.tags
  session.value.isStoryAdventure = updated.isStoryAdventure
  session.value.excludeFromKarma = updated.excludeFromKarma
  session.value.rankCombat = updated.rankCombat
  session.value.rankExploration = updated.rankExploration
  session.value.rankRoleplaying = updated.rankRoleplaying
}

// ── Sign-up ───────────────────────────────────────────────────────────────

async function handleSignUp() {
  if (signingUp.value) return
  signingUp.value = true

  if (signedUp.value) {
    const result = await sessionService.cancelSignUp(sessionId.value)
    if (result.type === 'ok') {
      if (session.value) session.value.mySignUp = null
      toast.add({ severity: 'success', summary: t('session.ab.card.cancel'), life: 3000 })
    } else {
      toast.add({ severity: 'error', summary: result.message, life: 5000 })
    }
  } else {
    const result = await sessionService.signUp(sessionId.value)
    if (result.type === 'ok') {
      if (session.value) {
        session.value.mySignUp = { id: result.data.id, status: result.data.status, appeared: false }
      }
      toast.add({ severity: 'success', summary: t('session.ab.card.signUp'), life: 3000 })
    } else {
      toast.add({ severity: 'error', summary: result.message, life: 5000 })
    }
  }

  signingUp.value = false
}

// ── DM status management ──────────────────────────────────────────────────

async function setStatus(newStatus: 'open' | 'confirmed' | 'cancelled') {
  if (updatingStatus.value || !session.value) return
  updatingStatus.value = true
  const result = await sessionService.update(sessionId.value, { status: newStatus })
  updatingStatus.value = false
  if (result.type === 'ok') {
    session.value.status = newStatus
    toast.add({ severity: 'success', summary: t(`session.ab.status.${newStatus}`), life: 3000 })
  } else {
    toast.add({ severity: 'error', summary: result.message, life: 5000 })
  }
}

// ── Release assignments toggle ────────────────────────────────────────────

async function toggleRelease(value: boolean) {
  if (savingRelease.value || !session.value) return
  savingRelease.value = true
  const result = await sessionService.update(sessionId.value, { releaseAssignments: value })
  savingRelease.value = false
  if (result.type === 'ok') {
    session.value.releaseAssignments = value
  } else {
    // Revert the toggle on failure
    session.value.releaseAssignments = !value
    toast.add({ severity: 'error', summary: result.message, life: 5000 })
  }
}

// ── Assignment management ─────────────────────────────────────────────────

function cycleAssignment(signUpId: string) {
  const current = pendingAssignments.value.get(signUpId) ?? 'pending'
  const cycle: SignUpStatus[] = ['pending', 'assigned', 'waitlist']
  const nextIndex = (cycle.indexOf(current) + 1) % cycle.length
  pendingAssignments.value.set(signUpId, cycle[nextIndex])
}

async function saveAssignments() {
  if (savingAssignments.value || !session.value) return
  savingAssignments.value = true

  const assignments = Array.from(pendingAssignments.value.entries()).map(([signUpId, status]) => ({
    signUpId,
    status,
  }))

  const result = await sessionService.assign(sessionId.value, assignments)
  savingAssignments.value = false

  if (result.type === 'ok') {
    // Apply optimistic state to session signups
    for (const su of session.value.signups) {
      const updated = pendingAssignments.value.get(su.signUpId)
      if (updated) su.status = updated
    }
    toast.add({ severity: 'success', summary: t('session.ab.detail.assignSection'), life: 3000 })
  } else {
    toast.add({ severity: 'error', summary: result.message, life: 5000 })
    // Reset pending to server state on error
    if (session.value) initPendingState(session.value)
  }
}

// ── Attendance ────────────────────────────────────────────────────────────

async function saveAttendance() {
  if (savingAttendance.value || !session.value) return
  savingAttendance.value = true

  const attendance = Array.from(pendingAttendance.value.entries()).map(([signUpId, appeared]) => ({
    signUpId,
    appeared,
  }))

  const result = await sessionService.markAttendance(sessionId.value, attendance)
  savingAttendance.value = false

  if (result.type === 'ok') {
    for (const su of session.value.signups) {
      const updated = pendingAttendance.value.get(su.signUpId)
      if (updated !== undefined) su.appeared = updated
    }
    toast.add({ severity: 'success', summary: t('session.ab.detail.attendance'), life: 3000 })
  } else {
    toast.add({ severity: 'error', summary: result.message, life: 5000 })
    if (session.value) initPendingState(session.value)
  }
}

// ── Formatting helpers ────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
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

function signUpStatusSeverity(status: SignUpStatus): string {
  const map: Record<SignUpStatus, string> = {
    pending: 'secondary',
    assigned: 'success',
    waitlist: 'warn',
    cancelled: 'danger',
  }
  return map[status]
}

function signUpLabel(su: SessionPlayer): string {
  return t(`session.ab.card.${su.status === 'pending' ? 'signed' : su.status}`)
}

const RANK_KEYS = ['combat', 'exploration', 'roleplay'] as const
type RankKey = (typeof RANK_KEYS)[number]

function rankValue(key: RankKey): number {
  if (!session.value) return 0
  if (key === 'combat') return session.value.rankCombat
  if (key === 'exploration') return session.value.rankExploration
  return session.value.rankRoleplaying
}

function assignmentStatus(signUpId: string): SignUpStatus {
  return pendingAssignments.value.get(signUpId) ?? 'pending'
}

function attendanceChecked(signUpId: string): boolean {
  return pendingAttendance.value.get(signUpId) ?? false
}

function setAttendance(signUpId: string, value: boolean) {
  pendingAttendance.value.set(signUpId, value)
}
</script>

<template>
  <div class="sd-view">
    <!-- Back button -->
    <div class="sd-back">
      <Button
        :label="t('session.ab.detail.back')"
        icon="pi pi-arrow-left"
        severity="secondary"
        text
        @click="router.push({ name: 'sessions' })"
      />
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="sd-skeleton">
      <Skeleton height="2rem" width="60%" class="sd-skel-row" />
      <Skeleton height="1rem" width="30%" class="sd-skel-row" />
      <Skeleton height="1rem" class="sd-skel-row" />
      <Skeleton height="1rem" class="sd-skel-row" />
      <Skeleton height="8rem" class="sd-skel-row" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="sd-error">
      <i class="pi pi-exclamation-triangle" />
      <span>{{ error }}</span>
    </div>

    <template v-else-if="session">
      <!-- ── Session header ──────────────────────────────────────────────── -->
      <div class="sd-header">
        <div class="sd-header-top">
          <div class="sd-header-meta">
            <p class="sd-date">{{ formatDate(session.date) }}</p>
            <Tag
              :value="t(`session.ab.status.${session.status}`)"
              :severity="statusSeverity(session.status)"
            />
            <Tag
              v-if="session.isStoryAdventure"
              :value="t('session.ab.card.story')"
              severity="warn"
              icon="pi pi-book"
            />
          </div>

          <!-- Player sign-up button -->
          <Button
            v-if="canSignUp"
            :label="signedUp ? t('session.ab.card.cancel') : t('session.ab.card.signUp')"
            :icon="signedUp ? 'pi pi-times' : 'pi pi-check'"
            :severity="signedUp ? 'secondary' : 'primary'"
            :loading="signingUp"
            @click="handleSignUp"
          />
        </div>

        <h1 class="sd-title">{{ session.title }}</h1>

        <!-- DM row -->
        <div v-if="session.dm" class="sd-dm">
          <div class="sd-avatar" :aria-hidden="true">
            <img
              v-if="session.dm.avatarUrl"
              :src="session.dm.avatarUrl"
              :alt="session.dm.displayName"
            />
            <span v-else class="sd-avatar-initial">{{ session.dm.displayName.charAt(0).toUpperCase() }}</span>
          </div>
          <span class="sd-dm-name">{{ session.dm.displayName }}</span>
        </div>

        <!-- Description -->
        <p v-if="session.shortDescription" class="sd-desc">{{ session.shortDescription }}</p>

        <!-- Rank pips -->
        <div class="sd-ranks">
          <div v-for="key in RANK_KEYS" :key="key" class="sd-rank" :title="t(`session.ab.ranks.${key}`)">
            <span class="sd-rank-label">{{ t(`session.ab.ranks.${key}`) }}</span>
            <div class="sd-rank-pips">
              <span
                v-for="pip in 3"
                :key="pip"
                class="sd-rank-pip"
                :class="{ 'sd-rank-pip--filled': pip <= rankValue(key) }"
              />
            </div>
          </div>
        </div>

        <!-- Tags -->
        <div v-if="session.tags.length > 0" class="sd-tags">
          <Tag
            v-for="tag in session.tags"
            :key="tag"
            :value="tag"
            severity="secondary"
            class="sd-tag"
          />
        </div>

        <!-- Capacity -->
        <div class="sd-capacity">
          <div class="sd-capacity-bar" role="progressbar" :aria-valuenow="session.assignedCount" :aria-valuemax="session.maxPlayers">
            <div
              class="sd-capacity-fill"
              :class="{ 'sd-capacity-fill--full': session.assignedCount >= session.maxPlayers }"
              :style="{ width: `${Math.min(100, Math.round((session.assignedCount / session.maxPlayers) * 100))}%` }"
            />
          </div>
          <span class="sd-capacity-label">{{ session.assignedCount }} / {{ session.maxPlayers }}</span>
        </div>
      </div>

      <!-- ── Sign-up list ────────────────────────────────────────────────── -->
      <section class="sd-section">
        <h2 class="sd-section-title">{{ t('session.ab.detail.assignSection') }}</h2>

        <!-- Not released message for regular players -->
        <p
          v-if="!isDmOrAdmin && !isSessionOwner && !session.releaseAssignments"
          class="sd-not-released"
        >
          <i class="pi pi-lock" />
          {{ t('session.ab.detail.notReleased') }}
        </p>

        <div v-else-if="visibleSignups.length === 0" class="sd-empty-signups">
          <i class="pi pi-users" />
        </div>

        <ul v-else class="sd-signup-list">
          <li
            v-for="su in visibleSignups"
            :key="su.signUpId"
            class="sd-signup-row"
          >
            <div class="sd-signup-avatar" :aria-hidden="true">
              <img
                v-if="su.avatarUrl"
                :src="su.avatarUrl"
                :alt="su.displayName"
              />
              <span v-else class="sd-signup-initial">{{ su.displayName.charAt(0).toUpperCase() }}</span>
            </div>
            <span class="sd-signup-name">{{ su.displayName }}</span>
            <Tag
              :value="signUpLabel(su)"
              :severity="signUpStatusSeverity(su.status)"
              class="sd-signup-status"
            />
          </li>
        </ul>
      </section>

      <!-- ── Edit session dialog ──────────────────────────────────────────── -->
      <SessionFormDialog
        v-model:visible="editDialogVisible"
        :session="sessionAsSummary"
        @saved="onSessionEdited"
      />

      <!-- ── DM management panel ────────────────────────────────────────── -->
      <section v-if="canManage" class="sd-section sd-dm-panel">
        <h2 class="sd-section-title">DM</h2>

        <!-- Status actions -->
        <div class="sd-dm-actions">
          <Button
            :label="t('session.ab.detail.edit')"
            icon="pi pi-pencil"
            severity="secondary"
            outlined
            @click="editDialogVisible = true"
          />
        </div>
        <div class="sd-dm-actions">
          <Button
            v-if="session.status === 'draft'"
            :label="t('session.ab.detail.openForSignups')"
            icon="pi pi-unlock"
            :loading="updatingStatus"
            @click="setStatus('open')"
          />
          <Button
            v-if="session.status === 'open'"
            :label="t('session.ab.detail.confirm')"
            icon="pi pi-check-circle"
            severity="success"
            :loading="updatingStatus"
            @click="setStatus('confirmed')"
          />
          <Button
            v-if="session.status !== 'cancelled' && session.status !== 'completed'"
            :label="t('session.ab.detail.cancelSession')"
            icon="pi pi-times-circle"
            severity="danger"
            outlined
            :loading="updatingStatus"
            @click="setStatus('cancelled')"
          />
        </div>

        <!-- Release assignments toggle -->
        <div class="sd-dm-release">
          <label class="sd-toggle-label" :for="`release-toggle-${session.id}`">
            {{ t('session.ab.detail.releaseToggle') }}
          </label>
          <ToggleSwitch
            :id="`release-toggle-${session.id}`"
            :model-value="assignmentsReleased"
            :disabled="savingRelease"
            @update:model-value="toggleRelease"
          />
        </div>

        <!-- Assignment management -->
        <div v-if="session.signups.length > 0" class="sd-assign-section">
          <h3 class="sd-subsection-title">{{ t('session.ab.detail.assignSection') }}</h3>
          <ul class="sd-assign-list">
            <li
              v-for="su in session.signups"
              :key="su.signUpId"
              class="sd-assign-row"
            >
              <div class="sd-signup-avatar" :aria-hidden="true">
                <img
                  v-if="su.avatarUrl"
                  :src="su.avatarUrl"
                  :alt="su.displayName"
                />
                <span v-else class="sd-signup-initial">{{ su.displayName.charAt(0).toUpperCase() }}</span>
              </div>
              <span class="sd-signup-name">{{ su.displayName }}</span>
              <button
                class="sd-assign-status-btn"
                :class="`sd-assign-status-btn--${assignmentStatus(su.signUpId)}`"
                @click="cycleAssignment(su.signUpId)"
              >
                {{ t(`session.ab.card.${assignmentStatus(su.signUpId) === 'pending' ? 'signed' : assignmentStatus(su.signUpId)}`) }}
              </button>
            </li>
          </ul>
          <Button
            :label="t('session.ab.detail.assignSection')"
            icon="pi pi-save"
            size="small"
            :loading="savingAssignments"
            @click="saveAssignments"
          />
        </div>

        <!-- Attendance -->
        <div v-if="canMarkAttendance && assignedSignups.length > 0" class="sd-attendance-section">
          <h3 class="sd-subsection-title">{{ t('session.ab.detail.attendance') }}</h3>
          <ul class="sd-attendance-list">
            <li
              v-for="su in assignedSignups"
              :key="su.signUpId"
              class="sd-attendance-row"
            >
              <Checkbox
                :binary="true"
                :model-value="attendanceChecked(su.signUpId)"
                :input-id="`attend-${su.signUpId}`"
                @update:model-value="(val) => setAttendance(su.signUpId, val)"
              />
              <label :for="`attend-${su.signUpId}`" class="sd-attend-label">
                <div class="sd-signup-avatar" :aria-hidden="true">
                  <img
                    v-if="su.avatarUrl"
                    :src="su.avatarUrl"
                    :alt="su.displayName"
                  />
                  <span v-else class="sd-signup-initial">{{ su.displayName.charAt(0).toUpperCase() }}</span>
                </div>
                {{ su.displayName }}
              </label>
            </li>
          </ul>
          <Button
            :label="t('session.ab.detail.attendance')"
            icon="pi pi-save"
            size="small"
            :loading="savingAttendance"
            @click="saveAttendance"
          />
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.sd-view {
  padding: 1.5rem;
  max-width: 900px;
  margin: 0 auto;
}

/* ── Back ────────────────────────────────────────────────────────────────── */

.sd-back {
  margin-bottom: 1rem;
}

/* ── Skeleton ────────────────────────────────────────────────────────────── */

.sd-skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.sd-skel-row {
  border-radius: var(--ss-radius-sm);
}

/* ── Error ───────────────────────────────────────────────────────────────── */

.sd-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem;
  color: var(--ss-danger);
  justify-content: center;
}

/* ── Header ──────────────────────────────────────────────────────────────── */

.sd-header {
  background: var(--ss-surface-raised);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius-lg);
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.sd-header-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.sd-header-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.sd-date {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ss-primary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0;
}

.sd-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--ss-text);
  margin: 0;
  line-height: 1.2;
}

/* ── DM row ──────────────────────────────────────────────────────────────── */

.sd-dm {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sd-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--ss-parchment-dark);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sd-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sd-avatar-initial {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--ss-text-muted);
}

.sd-dm-name {
  font-size: 0.9rem;
  color: var(--ss-text-muted);
}

/* ── Description ─────────────────────────────────────────────────────────── */

.sd-desc {
  font-size: 0.95rem;
  color: var(--ss-text);
  margin: 0;
  line-height: 1.6;
}

/* ── Ranks ───────────────────────────────────────────────────────────────── */

.sd-ranks {
  display: flex;
  gap: 1.5rem;
}

.sd-rank {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sd-rank-label {
  font-size: 0.8rem;
  color: var(--ss-text-muted);
}

.sd-rank-pips {
  display: flex;
  gap: 3px;
}

.sd-rank-pip {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--ss-border);
}

.sd-rank-pip--filled {
  background: var(--ss-primary);
}

/* ── Tags ────────────────────────────────────────────────────────────────── */

.sd-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.sd-tag {
  font-size: 0.75rem;
}

/* ── Capacity ────────────────────────────────────────────────────────────── */

.sd-capacity {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.sd-capacity-bar {
  flex: 1;
  max-width: 200px;
  height: 8px;
  background: var(--ss-border);
  border-radius: 4px;
  overflow: hidden;
}

.sd-capacity-fill {
  height: 100%;
  background: var(--ss-warning);
  border-radius: 4px;
  transition: width 0.3s;
}

.sd-capacity-fill--full {
  background: var(--ss-success);
}

.sd-capacity-label {
  font-size: 0.85rem;
  color: var(--ss-text-muted);
}

/* ── Sections ────────────────────────────────────────────────────────────── */

.sd-section {
  background: var(--ss-surface-raised);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius-lg);
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.sd-section-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--ss-text);
  margin: 0 0 1rem 0;
}

.sd-subsection-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ss-text);
  margin: 1rem 0 0.5rem 0;
}

/* ── Sign-up list ────────────────────────────────────────────────────────── */

.sd-not-released {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--ss-text-muted);
  font-style: italic;
  font-size: 0.9rem;
  padding: 0.5rem 0;
}

.sd-empty-signups {
  display: flex;
  justify-content: center;
  padding: 1.5rem;
  color: var(--ss-border);
  font-size: 1.5rem;
}

.sd-signup-list,
.sd-assign-list,
.sd-attendance-list {
  list-style: none;
  padding: 0;
  margin: 0 0 1rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sd-signup-row,
.sd-assign-row,
.sd-attendance-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--ss-border-subtle);
}

.sd-signup-row:last-child,
.sd-assign-row:last-child,
.sd-attendance-row:last-child {
  border-bottom: none;
}

.sd-signup-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--ss-parchment-dark);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sd-signup-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sd-signup-initial {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--ss-text-muted);
}

.sd-signup-name {
  flex: 1;
  font-size: 0.9rem;
  color: var(--ss-text);
}

.sd-signup-status {
  font-size: 0.75rem;
}

/* ── DM panel ────────────────────────────────────────────────────────────── */

.sd-dm-panel {
  border-color: var(--ss-primary);
}

.sd-dm-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.sd-dm-release {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--ss-border-subtle);
  margin-bottom: 0.5rem;
}

.sd-toggle-label {
  font-size: 0.9rem;
  color: var(--ss-text);
  cursor: pointer;
}

/* ── Assignment status buttons ───────────────────────────────────────────── */

.sd-assign-status-btn {
  padding: 0.2rem 0.6rem;
  border-radius: var(--ss-radius-sm);
  border: 1px solid var(--ss-border);
  font-size: 0.75rem;
  cursor: pointer;
  background: transparent;
  color: var(--ss-text-muted);
  transition: background 0.15s, color 0.15s;
}

.sd-assign-status-btn--assigned {
  background: var(--ss-success-bg);
  color: var(--ss-success);
  border-color: var(--ss-success);
}

.sd-assign-status-btn--waitlist {
  background: var(--ss-warning-bg);
  color: var(--ss-warning);
  border-color: var(--ss-warning);
}

.sd-assign-section,
.sd-attendance-section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--ss-border-subtle);
}

/* ── Attendance ──────────────────────────────────────────────────────────── */

.sd-attend-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--ss-text);
}

/* ── Responsive ──────────────────────────────────────────────────────────── */

@media (max-width: 767px) {
  .sd-view {
    padding: 1rem;
  }

  .sd-title {
    font-size: 1.35rem;
  }

  .sd-header {
    padding: 1rem;
  }

  .sd-section {
    padding: 1rem;
  }

  .sd-dm-actions {
    flex-direction: column;
  }

  .sd-ranks {
    flex-direction: column;
    gap: 0.75rem;
  }
}
</style>
