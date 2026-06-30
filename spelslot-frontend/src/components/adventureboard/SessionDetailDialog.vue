<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Skeleton from 'primevue/skeleton'
import Checkbox from 'primevue/checkbox'
import ToggleSwitch from 'primevue/toggleswitch'
import {
  sessionService,
  type SessionDetail,
  type SessionSummary,
  type SessionPlayer,
  type SignUpStatus,
} from '@/services/sessionService'
import { useAuthStore } from '@/stores/auth'
import SessionFormDialog from '@/components/adventureboard/SessionFormDialog.vue'
import combatIcon from '@/assets/spiked-dragon-head.svg'
import explorationIcon from '@/assets/dungeon-gate.svg'
import roleplayIcon from '@/assets/drama-masks.svg'

// ── Props & emits ──────────────────────────────────────────────────────────

const props = defineProps<{
  visible: boolean
  sessionId: string | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'signup-changed': [
    sessionId: string,
    mySignUp: { id: string; status: SignUpStatus; priority: number; appeared: boolean } | null,
    signupCountDelta: number,
  ]
  'session-updated': [session: SessionSummary]
}>()

// ── Dependencies ───────────────────────────────────────────────────────────

const { t } = useI18n()
const toast = useToast()
const auth = useAuthStore()

// ── State ──────────────────────────────────────────────────────────────────

const session = ref<SessionDetail | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const editDialogVisible = ref(false)
const signingUp = ref(false)
const updatingStatus = ref(false)
const savingAssignments = ref(false)
const savingAttendance = ref(false)
const savingRelease = ref(false)

const pendingAssignments = ref<Map<string, SignUpStatus>>(new Map())
const pendingAttendance = ref<Map<string, boolean>>(new Map())

// ── Derived ────────────────────────────────────────────────────────────────

const isSessionOwner = computed(() => {
  if (!session.value?.dm) return false
  return session.value.dm.uid === auth.user?.uid
})

const canManage = computed(() => isSessionOwner.value || auth.hasPermission('ADMIN'))

const canRelease = computed(() => auth.hasPermission('ADMIN'))

const canSignUp = computed(() => {
  if (!session.value) return false
  return session.value.status === 'open'
})

const signedUp = computed(() => {
  const su = session.value?.mySignUp
  return !!su && su.status !== 'cancelled'
})

const visibleSignups = computed((): SessionPlayer[] => {
  if (!session.value) return []
  const signups = [...session.value.signups].sort((a, b) => a.priority - b.priority)
  if (auth.hasPermission('ADMIN')) return signups
  if (session.value.releaseAssignments) return signups
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
    signupCount: s.signups.filter((su) => su.status !== 'cancelled').length,
    assignedCount: s.signups.filter((su) => su.status === 'assigned').length,
    mySignUp: s.mySignUp,
    requestedRoom: s.requestedRoom,
    assignedRoom: s.assignedRoom,
    predecessorId: s.predecessorId,
    numSessions: s.numSessions,
    sessionNumber: s.sessionNumber,
    requestedPlayerIds: s.requestedPlayerIds,
    isWaitingList: s.isWaitingList,
    assignedPlayers: null,
  }
})

// ── Data fetching ──────────────────────────────────────────────────────────

async function loadSession(id: string) {
  loading.value = true
  error.value = null
  const result = await sessionService.get(id)
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

function resetState() {
  session.value = null
  error.value = null
  loading.value = false
  signingUp.value = false
  updatingStatus.value = false
  savingAssignments.value = false
  savingAttendance.value = false
  savingRelease.value = false
  pendingAssignments.value = new Map()
  pendingAttendance.value = new Map()
}

watch(
  () => [props.visible, props.sessionId] as const,
  ([visible, sessionId]) => {
    if (visible && sessionId) {
      loadSession(sessionId)
    } else if (!visible) {
      resetState()
    }
  },
  { immediate: true },
)

// ── Edit session ───────────────────────────────────────────────────────────

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
  emit('session-updated', updated)
}

// ── Sign-up ────────────────────────────────────────────────────────────────

async function handleChoicePick(choice: 1 | 2 | 3) {
  if (signingUp.value || !props.sessionId) return
  signingUp.value = true

  const currentPriority = session.value?.mySignUp?.priority

  // Always POST — backend handles toggle-off (same session + same priority) internally
  const result = await sessionService.signUp(props.sessionId, choice)

  if (result.type === 'ok') {
    if (result.data === null) {
      // Backend toggled off: same session, same priority was already set
      if (session.value) session.value.mySignUp = null
      emit('signup-changed', props.sessionId, null, -1)
      toast.add({ severity: 'success', summary: 'Aanmelding verwijderd', life: 3000 })
    } else {
      const newSignUp = {
        id: result.data.id,
        status: result.data.status,
        priority: result.data.priority,
        appeared: false,
      }
      if (session.value) session.value.mySignUp = newSignUp
      const delta = currentPriority ? 0 : 1
      emit('signup-changed', props.sessionId, newSignUp, delta)
      toast.add({ severity: 'success', summary: `Keuze ${choice} ingesteld`, life: 3000 })
    }
  } else {
    toast.add({ severity: 'error', summary: result.message, life: 5000 })
  }

  signingUp.value = false
}

// ── DM status management ───────────────────────────────────────────────────

async function setStatus(newStatus: 'open' | 'confirmed' | 'cancelled') {
  if (updatingStatus.value || !session.value || !props.sessionId) return
  updatingStatus.value = true
  const result = await sessionService.update(props.sessionId, { status: newStatus })
  updatingStatus.value = false
  if (result.type === 'ok') {
    session.value.status = newStatus
    toast.add({ severity: 'success', summary: t(`session.ab.status.${newStatus}`), life: 3000 })
  } else {
    toast.add({ severity: 'error', summary: result.message, life: 5000 })
  }
}

// ── Release assignments toggle ─────────────────────────────────────────────

async function toggleRelease(value: boolean) {
  if (savingRelease.value || !session.value || !props.sessionId) return
  savingRelease.value = true
  const result = await sessionService.update(props.sessionId, { releaseAssignments: value })
  savingRelease.value = false
  if (result.type === 'ok') {
    session.value.releaseAssignments = value
  } else {
    // Revert toggle on failure
    session.value.releaseAssignments = !value
    toast.add({ severity: 'error', summary: result.message, life: 5000 })
  }
}

// ── Assignment management ──────────────────────────────────────────────────

function cycleAssignment(signUpId: string) {
  const current = pendingAssignments.value.get(signUpId) ?? 'pending'
  const cycle: SignUpStatus[] = ['pending', 'assigned', 'waitlist']
  const nextIndex = (cycle.indexOf(current) + 1) % cycle.length
  pendingAssignments.value.set(signUpId, cycle[nextIndex])
}

async function saveAssignments() {
  if (savingAssignments.value || !session.value || !props.sessionId) return
  savingAssignments.value = true

  const assignments = Array.from(pendingAssignments.value.entries()).map(([signUpId, status]) => ({
    signUpId,
    status,
  }))

  const result = await sessionService.assign(props.sessionId, assignments)
  savingAssignments.value = false

  if (result.type === 'ok') {
    for (const su of session.value.signups) {
      const updated = pendingAssignments.value.get(su.signUpId)
      if (updated) su.status = updated
    }
    toast.add({ severity: 'success', summary: t('session.ab.detail.assignSection'), life: 3000 })
  } else {
    toast.add({ severity: 'error', summary: result.message, life: 5000 })
    if (session.value) initPendingState(session.value)
  }
}

// ── Requested players ──────────────────────────────────────────────────────

async function toggleRequestedPlayer(userId: string) {
  if (!session.value) return
  const isRequested = session.value.requestedPlayerIds.includes(userId)
  const result = isRequested
    ? await sessionService.removeRequestedPlayer(session.value.id, userId)
    : await sessionService.requestPlayer(session.value.id, userId)
  if (result.type === 'ok') {
    if (isRequested) {
      session.value.requestedPlayerIds = session.value.requestedPlayerIds.filter(
        (id) => id !== userId,
      )
    } else {
      session.value.requestedPlayerIds.push(userId)
    }
  } else {
    toast.add({ severity: 'error', summary: result.message, life: 5000 })
  }
}

// ── Attendance ─────────────────────────────────────────────────────────────

async function saveAttendance() {
  if (savingAttendance.value || !session.value || !props.sessionId) return
  savingAttendance.value = true

  const attendance = Array.from(pendingAttendance.value.entries()).map(([signUpId, appeared]) => ({
    signUpId,
    appeared,
  }))

  const result = await sessionService.markAttendance(props.sessionId, attendance)
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

// ── Formatting helpers ─────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
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

const RANK_ICONS: Record<RankKey, string> = {
  combat: combatIcon,
  exploration: explorationIcon,
  roleplay: roleplayIcon,
}

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
  <Dialog
    :visible="visible"
    modal
    :draggable="false"
    :style="{ width: '680px', maxWidth: '95vw' }"
    @update:visible="emit('update:visible', $event)"
  >
    <!-- Custom header slot: title + edit button -->
    <template #header>
      <div class="sdd-dialog-header">
        <span class="sdd-dialog-title">
          {{ session ? session.title : (loading ? '' : 'Sessie') }}
        </span>
        <Button
          v-if="session && canManage"
          :label="t('session.ab.detail.edit')"
          icon="pi pi-pencil"
          size="small"
          severity="secondary"
          outlined
          @click="editDialogVisible = true"
        />
      </div>
    </template>

    <!-- Loading skeleton -->
    <div v-if="loading" class="sdd-skeleton">
      <Skeleton height="0.9rem" width="40%" class="sdd-skel-row" />
      <Skeleton height="1.5rem" width="70%" class="sdd-skel-row" />
      <Skeleton height="1rem" width="55%" class="sdd-skel-row" />
      <Skeleton height="0.9rem" class="sdd-skel-row" />
      <Skeleton height="0.9rem" class="sdd-skel-row" />
      <Skeleton height="6rem" class="sdd-skel-row" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="sdd-error" role="alert">
      <i class="pi pi-exclamation-triangle" />
      <span>{{ error }}</span>
    </div>

    <template v-else-if="session">
      <!-- ── Header area ─────────────────────────────────────────────────── -->
      <div class="sdd-header">
        <!-- Full date -->
        <p class="sdd-date">{{ formatDate(session.date) }}</p>

        <!-- Status + story + multi-session tags -->
        <div class="sdd-meta-tags">
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
          <Tag
            v-if="session.numSessions > 1"
            :value="`Deel ${session.sessionNumber}/${session.numSessions}`"
            severity="info"
            icon="pi pi-link"
          />
        </div>

        <!-- DM row -->
        <div v-if="session.dm" class="sdd-dm">
          <div class="sdd-avatar" aria-hidden="true">
            <img
              v-if="session.dm.avatarUrl"
              :src="session.dm.avatarUrl"
              :alt="session.dm.displayName"
            />
            <span v-else class="sdd-avatar-initial">
              {{ session.dm.displayName.charAt(0).toUpperCase() }}
            </span>
          </div>
          <span class="sdd-dm-name">{{ session.dm.displayName }}</span>
        </div>

        <!-- Short description -->
        <p v-if="session.shortDescription" class="sdd-desc">{{ session.shortDescription }}</p>

        <!-- Room -->
        <div class="sdd-meta-row">
          <div v-if="session.assignedRoom" class="sdd-meta-item">
            <i class="pi pi-map-marker sdd-meta-icon" />
            <span>{{ session.assignedRoom }}</span>
          </div>
          <div v-else-if="session.requestedRoom" class="sdd-meta-item sdd-meta-item--muted">
            <i class="pi pi-map-marker sdd-meta-icon" />
            <span>Gevraagd: {{ session.requestedRoom }}</span>
          </div>
        </div>

        <!-- Rank pips (3x per type) -->
        <div class="sdd-ranks">
          <div
            v-for="key in RANK_KEYS"
            :key="key"
            class="sdd-rank"
            :title="t(`session.ab.ranks.${key}`)"
          >
            <img
              v-for="pip in 3"
              :key="pip"
              :src="RANK_ICONS[key]"
              class="sdd-rank-pip"
              :class="pip <= rankValue(key) ? 'sdd-rank-pip--on' : 'sdd-rank-pip--off'"
              :alt="pip === 1 ? t(`session.ab.ranks.${key}`) : ''"
            />
          </div>
        </div>

        <!-- Capacity bar + label -->
        <div class="sdd-capacity">
          <div
            class="sdd-capacity-bar"
            role="progressbar"
            :aria-valuenow="session.signups.filter(su => su.status === 'assigned').length"
            :aria-valuemax="session.maxPlayers"
          >
            <div
              class="sdd-capacity-fill"
              :class="{
                'sdd-capacity-fill--full':
                  session.signups.filter(su => su.status === 'assigned').length >= session.maxPlayers,
              }"
              :style="{
                width: `${Math.min(
                  100,
                  Math.round(
                    (session.signups.filter(su => su.status === 'assigned').length /
                      session.maxPlayers) *
                      100,
                  ),
                )}%`,
              }"
            />
          </div>
          <span class="sdd-capacity-label">
            {{ session.signups.filter(su => su.status === 'assigned').length }} /
            {{ session.maxPlayers }}
          </span>
        </div>

        <!-- Tags -->
        <div v-if="session.tags.length > 0" class="sdd-tags">
          <Tag
            v-for="tag in session.tags"
            :key="tag"
            :value="tag"
            severity="secondary"
            class="sdd-tag"
          />
        </div>
      </div>

      <!-- ── Sign-up section (players only, open sessions) ──────────────── -->
      <div v-if="canSignUp" class="sdd-section sdd-signup-section">
        <h3 class="sdd-section-title">Aanmelden</h3>
        <div class="sdd-choice-picker">
          <button
            v-for="choice in ([1, 2, 3] as const)"
            :key="choice"
            class="sdd-choice-btn"
            :class="{
              'sdd-choice-btn--active': session.mySignUp?.priority === choice && signedUp,
            }"
            :disabled="signingUp"
            :aria-pressed="session.mySignUp?.priority === choice && signedUp"
            :title="
              session.mySignUp?.priority === choice && signedUp
                ? `Keuze ${choice} actief — klik om te verwijderen`
                : `Aanmelden als keuze ${choice}`
            "
            @click="handleChoicePick(choice)"
          >
            {{ choice }}e keuze
          </button>
        </div>
      </div>

      <!-- ── Sign-up list (visible signups) ────────────────────────────── -->
      <section class="sdd-section">
        <h3 class="sdd-section-title">{{ t('session.ab.detail.assignSection') }}</h3>

        <p
          v-if="!auth.hasPermission('ADMIN') && !session.releaseAssignments"
          class="sdd-not-released"
        >
          <i class="pi pi-lock" />
          {{ t('session.ab.detail.notReleased') }}
        </p>

        <div v-else-if="visibleSignups.length === 0" class="sdd-empty-signups">
          <i class="pi pi-users" />
        </div>

        <ul v-else class="sdd-signup-list">
          <li
            v-for="su in visibleSignups"
            :key="su.signUpId"
            class="sdd-signup-row"
          >
            <div class="sdd-signup-avatar" aria-hidden="true">
              <img
                v-if="su.avatarUrl"
                :src="su.avatarUrl"
                :alt="su.displayName"
              />
              <span v-else class="sdd-signup-initial">
                {{ su.displayName.charAt(0).toUpperCase() }}
              </span>
            </div>
            <span class="sdd-signup-name">{{ su.displayName }}</span>
            <!-- Priority badge visible only to admins -->
            <span
              v-if="auth.hasPermission('ADMIN')"
              class="sdd-priority-badge"
              :class="`sdd-priority-badge--${su.priority <= 3 ? su.priority : 'ext'}`"
              :title="`Keuze ${su.priority}`"
            >
              {{ su.priority <= 3 ? su.priority : '~' }}
            </span>
            <Tag
              :value="signUpLabel(su)"
              :severity="signUpStatusSeverity(su.status)"
              class="sdd-signup-status"
            />
          </li>
        </ul>
      </section>

      <!-- ── DM management panel ────────────────────────────────────────── -->
      <section v-if="canManage" class="sdd-section sdd-dm-panel">
        <h3 class="sdd-section-title">DM beheer</h3>

        <!-- Status actions -->
        <div class="sdd-dm-actions">
          <Button
            v-if="session.status === 'open'"
            :label="t('session.ab.detail.confirm')"
            icon="pi pi-check-circle"
            severity="success"
            size="small"
            :loading="updatingStatus"
            @click="setStatus('confirmed')"
          />
          <Button
            v-if="session.status !== 'cancelled' && session.status !== 'completed'"
            :label="t('session.ab.detail.cancelSession')"
            icon="pi pi-times-circle"
            severity="danger"
            size="small"
            outlined
            :loading="updatingStatus"
            @click="setStatus('cancelled')"
          />
        </div>

        <!-- Release assignments toggle -->
        <div v-if="canRelease" class="sdd-dm-release">
          <label class="sdd-toggle-label" :for="`sdd-release-${session.id}`">
            {{ t('session.ab.detail.releaseToggle') }}
          </label>
          <ToggleSwitch
            :id="`sdd-release-${session.id}`"
            :model-value="assignmentsReleased"
            :disabled="savingRelease"
            @update:model-value="toggleRelease"
          />
        </div>

        <!-- Assignment list with priority badge + requested star + status cycle -->
        <div v-if="session.signups.length > 0" class="sdd-assign-section">
          <h4 class="sdd-subsection-title">{{ t('session.ab.detail.assignSection') }}</h4>
          <ul class="sdd-assign-list">
            <li
              v-for="su in session.signups"
              :key="su.signUpId"
              class="sdd-assign-row"
            >
              <!-- Priority badge: player's stated choice order -->
              <span
                class="sdd-priority-badge"
                :class="`sdd-priority-badge--${su.priority <= 3 ? su.priority : 'ext'}`"
                :title="`Keuze ${su.priority}`"
              >
                {{ su.priority <= 3 ? su.priority : '~' }}
              </span>

              <div class="sdd-signup-avatar" aria-hidden="true">
                <img
                  v-if="su.avatarUrl"
                  :src="su.avatarUrl"
                  :alt="su.displayName"
                />
                <span v-else class="sdd-signup-initial">
                  {{ su.displayName.charAt(0).toUpperCase() }}
                </span>
              </div>

              <span class="sdd-signup-name">{{ su.displayName }}</span>

              <!-- Requested (guaranteed spot) star toggle -->
              <button
                class="sdd-request-btn"
                :class="{ 'sdd-request-btn--active': session.requestedPlayerIds.includes(su.userId) }"
                :title="
                  session.requestedPlayerIds.includes(su.userId)
                    ? 'Gegarandeerde plek verwijderen'
                    : 'Gegarandeerde plek geven'
                "
                @click="toggleRequestedPlayer(su.userId)"
              >
                <i
                  :class="
                    session.requestedPlayerIds.includes(su.userId) ? 'pi pi-star-fill' : 'pi pi-star'
                  "
                />
              </button>

              <!-- Cycle assignment status button -->
              <button
                class="sdd-assign-status-btn"
                :class="`sdd-assign-status-btn--${assignmentStatus(su.signUpId)}`"
                @click="cycleAssignment(su.signUpId)"
              >
                {{
                  t(
                    `session.ab.card.${
                      assignmentStatus(su.signUpId) === 'pending'
                        ? 'signed'
                        : assignmentStatus(su.signUpId)
                    }`,
                  )
                }}
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

        <!-- Attendance section (confirmed/completed status) -->
        <div v-if="canMarkAttendance && assignedSignups.length > 0" class="sdd-attendance-section">
          <h4 class="sdd-subsection-title">{{ t('session.ab.detail.attendance') }}</h4>
          <ul class="sdd-attendance-list">
            <li
              v-for="su in assignedSignups"
              :key="su.signUpId"
              class="sdd-attendance-row"
            >
              <Checkbox
                :binary="true"
                :model-value="attendanceChecked(su.signUpId)"
                :input-id="`sdd-attend-${su.signUpId}`"
                @update:model-value="(val: boolean) => setAttendance(su.signUpId, val)"
              />
              <label :for="`sdd-attend-${su.signUpId}`" class="sdd-attend-label">
                <div class="sdd-signup-avatar" aria-hidden="true">
                  <img
                    v-if="su.avatarUrl"
                    :src="su.avatarUrl"
                    :alt="su.displayName"
                  />
                  <span v-else class="sdd-signup-initial">
                    {{ su.displayName.charAt(0).toUpperCase() }}
                  </span>
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

    <!-- Edit session sub-dialog -->
    <SessionFormDialog
      v-model:visible="editDialogVisible"
      :session="sessionAsSummary"
      @saved="onSessionEdited"
    />
  </Dialog>
</template>

<style scoped>
/* ── Dialog header ───────────────────────────────────────────────────────── */

.sdd-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex: 1;
  min-width: 0;
}

.sdd-dialog-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--ss-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Skeleton ────────────────────────────────────────────────────────────── */

.sdd-skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.25rem 0;
}

.sdd-skel-row {
  border-radius: var(--ss-radius-sm);
}

/* ── Error ───────────────────────────────────────────────────────────────── */

.sdd-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem;
  color: var(--ss-danger);
  justify-content: center;
}

/* ── Header area ─────────────────────────────────────────────────────────── */

.sdd-header {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--ss-border-subtle);
  margin-bottom: 1rem;
}

.sdd-date {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--ss-primary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0;
}

.sdd-meta-tags {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

/* ── DM row ──────────────────────────────────────────────────────────────── */

.sdd-dm {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sdd-avatar {
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

.sdd-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sdd-avatar-initial {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--ss-text-muted);
}

.sdd-dm-name {
  font-size: 0.85rem;
  color: var(--ss-text-muted);
}

/* ── Description ─────────────────────────────────────────────────────────── */

.sdd-desc {
  font-size: 0.9rem;
  color: var(--ss-text);
  margin: 0;
  line-height: 1.6;
}

/* ── Meta row (room) ─────────────────────────────────────────────────────── */

.sdd-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.sdd-meta-item {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.82rem;
  color: var(--ss-text);
}

.sdd-meta-item--muted {
  color: var(--ss-text-muted);
}

.sdd-meta-icon {
  font-size: 0.75rem;
  color: var(--ss-primary);
}

/* ── Rank pips ───────────────────────────────────────────────────────────── */

.sdd-ranks {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.sdd-rank {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 2px;
}

.sdd-rank-pip {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.sdd-rank-pip--on {
  color: var(--ss-primary);
  opacity: 1;
}

.sdd-rank-pip--off {
  opacity: 0.25;
}

/* ── Capacity ────────────────────────────────────────────────────────────── */

.sdd-capacity {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.sdd-capacity-bar {
  flex: 1;
  max-width: 180px;
  height: 6px;
  background: var(--ss-border);
  border-radius: 3px;
  overflow: hidden;
}

.sdd-capacity-fill {
  height: 100%;
  background: var(--ss-warning);
  border-radius: 3px;
  transition: width 0.3s;
}

.sdd-capacity-fill--full {
  background: var(--ss-success);
}

.sdd-capacity-label {
  font-size: 0.8rem;
  color: var(--ss-text-muted);
}

/* ── Tags ────────────────────────────────────────────────────────────────── */

.sdd-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.sdd-tag {
  font-size: 0.72rem;
}

/* ── Sections ────────────────────────────────────────────────────────────── */

.sdd-section {
  margin-bottom: 1.25rem;
}

.sdd-section:last-of-type {
  margin-bottom: 0;
}

.sdd-section-title {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--ss-text);
  margin: 0 0 0.75rem 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.sdd-subsection-title {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--ss-text);
  margin: 0.75rem 0 0.4rem 0;
}

/* ── Sign-up choice picker ───────────────────────────────────────────────── */

.sdd-signup-section {
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--ss-border-subtle);
  margin-bottom: 1rem;
}

.sdd-choice-picker {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.sdd-choice-btn {
  padding: 0.3rem 0.85rem;
  border-radius: 999px;
  border: 1.5px solid var(--ss-border);
  background: transparent;
  color: var(--ss-text-muted);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}

.sdd-choice-btn:hover:not(:disabled) {
  border-color: var(--ss-primary);
  color: var(--ss-primary);
}

.sdd-choice-btn--active {
  background: var(--ss-primary);
  border-color: var(--ss-primary);
  color: var(--ss-primary-fg);
}

.sdd-choice-btn--active:hover:not(:disabled) {
  background: color-mix(in srgb, var(--ss-primary) 85%, black);
}

.sdd-choice-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ── Sign-up list ────────────────────────────────────────────────────────── */

.sdd-not-released {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--ss-text-muted);
  font-style: italic;
  font-size: 0.875rem;
  padding: 0.25rem 0;
}

.sdd-empty-signups {
  display: flex;
  justify-content: center;
  padding: 1.25rem;
  color: var(--ss-border);
  font-size: 1.25rem;
}

.sdd-signup-list,
.sdd-assign-list,
.sdd-attendance-list {
  list-style: none;
  padding: 0;
  margin: 0 0 0.75rem 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.sdd-signup-row,
.sdd-assign-row,
.sdd-attendance-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--ss-border-subtle);
}

.sdd-signup-row:last-child,
.sdd-assign-row:last-child,
.sdd-attendance-row:last-child {
  border-bottom: none;
}

.sdd-signup-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--ss-parchment-dark);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sdd-signup-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sdd-signup-initial {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--ss-text-muted);
}

.sdd-signup-name {
  flex: 1;
  font-size: 0.875rem;
  color: var(--ss-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sdd-signup-status {
  font-size: 0.72rem;
  flex-shrink: 0;
}

/* ── Priority badge ──────────────────────────────────────────────────────── */

.sdd-priority-badge {
  width: 1.3rem;
  height: 1.3rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
  font-weight: 800;
  flex-shrink: 0;
}

.sdd-priority-badge--1 {
  background: color-mix(in srgb, var(--ss-success) 20%, transparent);
  color: var(--ss-success);
}

.sdd-priority-badge--2 {
  background: color-mix(in srgb, var(--ss-primary) 15%, transparent);
  color: var(--ss-primary);
}

.sdd-priority-badge--3 {
  background: color-mix(in srgb, var(--ss-text-muted) 15%, transparent);
  color: var(--ss-text-muted);
}

.sdd-priority-badge--ext {
  background: color-mix(in srgb, var(--ss-text-muted) 10%, transparent);
  color: var(--ss-text-muted);
}

/* ── DM panel ────────────────────────────────────────────────────────────── */

.sdd-dm-panel {
  background: color-mix(in srgb, var(--ss-primary) 4%, transparent);
  border: 1px solid color-mix(in srgb, var(--ss-primary) 25%, transparent);
  border-radius: var(--ss-radius);
  padding: 1rem;
}

.sdd-dm-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.sdd-dm-release {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0;
  border-bottom: 1px solid var(--ss-border-subtle);
  margin-bottom: 0.25rem;
}

.sdd-toggle-label {
  font-size: 0.875rem;
  color: var(--ss-text);
  cursor: pointer;
  flex: 1;
}

/* ── Requested player toggle ─────────────────────────────────────────────── */

.sdd-request-btn {
  background: none;
  border: none;
  padding: 0.2rem;
  cursor: pointer;
  color: var(--ss-text-muted);
  transition: color 0.15s;
  font-size: 0.85rem;
  flex-shrink: 0;
  line-height: 1;
}

.sdd-request-btn:hover {
  color: var(--ss-primary);
}

.sdd-request-btn--active {
  color: var(--ss-primary);
}

/* ── Assignment status cycle button ──────────────────────────────────────── */

.sdd-assign-status-btn {
  padding: 0.15rem 0.5rem;
  border-radius: var(--ss-radius-sm);
  border: 1px solid var(--ss-border);
  font-size: 0.72rem;
  cursor: pointer;
  background: transparent;
  color: var(--ss-text-muted);
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  flex-shrink: 0;
  white-space: nowrap;
}

.sdd-assign-status-btn--assigned {
  background: var(--ss-success-bg);
  color: var(--ss-success);
  border-color: var(--ss-success);
}

.sdd-assign-status-btn--waitlist {
  background: var(--ss-warning-bg);
  color: var(--ss-warning);
  border-color: var(--ss-warning);
}

/* ── Assign + attendance subsections ─────────────────────────────────────── */

.sdd-assign-section,
.sdd-attendance-section {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--ss-border-subtle);
}

/* ── Attendance label ────────────────────────────────────────────────────── */

.sdd-attend-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--ss-text);
  flex: 1;
}

/* ── Responsive ──────────────────────────────────────────────────────────── */

@media (max-width: 767px) {
  .sdd-ranks {
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .sdd-dm-actions {
    flex-direction: column;
  }

  .sdd-choice-picker {
    flex-direction: column;
  }

  .sdd-choice-btn {
    width: 100%;
    justify-content: center;
    display: flex;
  }
}
</style>
