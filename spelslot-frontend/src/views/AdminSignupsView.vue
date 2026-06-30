<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Button from 'primevue/button'
import Avatar from 'primevue/avatar'
import Tag from 'primevue/tag'
import Skeleton from 'primevue/skeleton'
import { sessionService, type AdminSignupsResult, type AdminSignupsUser } from '@/services/sessionService'

// ── State ─────────────────────────────────────────────────────────────────

const data = ref<AdminSignupsResult | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const currentWeekMonday = ref<string>(getUpcomingMonday())

// ── Week helpers ──────────────────────────────────────────────────────────

function getUpcomingMonday(): string {
  const today = new Date()
  const day = today.getDay()
  const daysFromMon = day === 0 ? 6 : day - 1
  const thisMon = new Date(today)
  thisMon.setDate(today.getDate() - daysFromMon)
  thisMon.setHours(0, 0, 0, 0)
  const offset = day >= 1 && day <= 3 ? 0 : 7
  const result = new Date(thisMon)
  result.setDate(thisMon.getDate() + offset)
  return result.toISOString().slice(0, 10)
}

const weekLabel = computed(() => {
  const monday = new Date(currentWeekMonday.value)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  return `${fmt(monday)} – ${fmt(sunday)}`
})

function shiftWeek(delta: number) {
  const d = new Date(currentWeekMonday.value)
  d.setDate(d.getDate() + delta * 7)
  currentWeekMonday.value = d.toISOString().slice(0, 10)
  load()
}

// ── Data fetching ─────────────────────────────────────────────────────────

async function load() {
  loading.value = true
  error.value = null
  const result = await sessionService.getAdminSignups(currentWeekMonday.value)
  loading.value = false
  if (result.type === 'ok') {
    data.value = result.data
  } else {
    error.value = result.message
  }
}

onMounted(() => load())

// ── Helpers ───────────────────────────────────────────────────────────────

function signupForPriority(user: AdminSignupsUser, priority: number) {
  return user.signups.find((s) => s.priority === priority) ?? null
}

function statusSeverity(status: string): 'info' | 'warn' | 'success' | 'secondary' {
  if (status === 'assigned') return 'success'
  if (status === 'waitlist') return 'warn'
  if (status === 'pending') return 'info'
  return 'secondary'
}

function avatarLabel(name: string) {
  return name.charAt(0).toUpperCase() || '?'
}

// Sort users: those with signups first, then by karma desc
const sortedUsers = computed(() => {
  if (!data.value) return []
  return [...data.value.users].sort((a, b) => {
    if (a.signups.length !== b.signups.length) return b.signups.length - a.signups.length
    return b.karma - a.karma
  })
})
</script>

<template>
  <div class="as-view">
    <!-- Header -->
    <div class="as-header">
      <h1 class="as-title">Aanmeldingen</h1>

      <!-- Week navigation -->
      <div class="as-week-nav">
        <button class="as-week-btn" :disabled="loading" @click="shiftWeek(-1)">
          <i class="pi pi-chevron-left" />
        </button>
        <span class="as-week-label">{{ weekLabel }}</span>
        <button class="as-week-btn" :disabled="loading" @click="shiftWeek(1)">
          <i class="pi pi-chevron-right" />
        </button>
      </div>
    </div>

    <!-- Sessions legend -->
    <div v-if="data && data.sessions.length" class="as-legend">
      <div v-for="(session, idx) in data.sessions" :key="session.id" class="as-legend-item">
        <span class="as-legend-num">{{ idx + 1 }}</span>
        <span class="as-legend-title">{{ session.title }}</span>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="as-table-wrap">
      <div v-for="n in 8" :key="n" class="as-skeleton-row">
        <Skeleton width="160px" height="1rem" />
        <Skeleton width="80px" height="1rem" />
        <Skeleton width="80px" height="1rem" />
        <Skeleton width="80px" height="1rem" />
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="as-error">{{ error }}</div>

    <!-- Empty -->
    <div v-else-if="!data || sortedUsers.length === 0" class="as-empty">
      <i class="pi pi-calendar" />
      <p>Geen aanmeldingen voor deze week</p>
    </div>

    <!-- Table -->
    <div v-else class="as-table-wrap">
      <table class="as-table">
        <thead>
          <tr>
            <th class="as-th as-th--player">Speler</th>
            <th class="as-th as-th--karma">Karma</th>
            <th class="as-th">Keuze 1</th>
            <th class="as-th">Keuze 2</th>
            <th class="as-th">Keuze 3</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in sortedUsers" :key="user.userId" class="as-tr">
            <td class="as-td as-td--player">
              <Avatar
                :image="user.avatarUrl ?? undefined"
                :label="user.avatarUrl ? undefined : avatarLabel(user.displayName)"
                shape="circle"
                size="small"
                class="as-avatar"
              />
              <span class="as-name">{{ user.displayName }}</span>
            </td>
            <td class="as-td as-td--karma">{{ user.karma }}</td>
            <td v-for="prio in 3" :key="prio" class="as-td">
              <template v-if="signupForPriority(user, prio)">
                <Tag
                  :value="signupForPriority(user, prio)!.sessionTitle"
                  :severity="statusSeverity(signupForPriority(user, prio)!.status)"
                  class="as-tag"
                />
              </template>
              <span v-else class="as-empty-cell">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.as-view {
  padding: 1.5rem;
  max-width: 1100px;
}

.as-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
}

.as-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--ss-text);
  margin: 0;
}

/* ── Week navigation ── */

.as-week-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.as-week-btn {
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
  transition: background 0.15s;
}

.as-week-btn:hover:not(:disabled) {
  background: var(--ss-surface-raised);
  color: var(--ss-primary);
}

.as-week-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.as-week-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ss-text);
  min-width: 170px;
  text-align: center;
}

/* ── Session legend ── */

.as-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.as-legend-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: var(--ss-text-muted);
}

.as-legend-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.2em;
  height: 1.2em;
  border-radius: 50%;
  background: var(--ss-primary);
  color: var(--ss-primary-fg, #fff);
  font-size: 0.65rem;
  font-weight: 700;
  flex-shrink: 0;
}

/* ── Table ── */

.as-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
}

.as-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.as-th {
  padding: 0.6rem 0.75rem;
  text-align: left;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ss-text-muted);
  background: var(--ss-surface);
  border-bottom: 1px solid var(--ss-border);
  white-space: nowrap;
}

.as-th--player {
  min-width: 180px;
}

.as-th--karma {
  width: 80px;
  text-align: right;
}

.as-tr:not(:last-child) {
  border-bottom: 1px solid var(--ss-border-subtle, var(--ss-border));
}

.as-tr:hover {
  background: var(--ss-surface-raised);
}

.as-td {
  padding: 0.5rem 0.75rem;
  vertical-align: middle;
}

.as-td--player {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.as-td--karma {
  text-align: right;
  color: var(--ss-text-muted);
  font-variant-numeric: tabular-nums;
}

.as-avatar {
  width: 24px !important;
  height: 24px !important;
  font-size: 0.65rem !important;
  flex-shrink: 0;
}

.as-name {
  font-weight: 500;
  color: var(--ss-text);
  white-space: nowrap;
}

.as-tag {
  font-size: 0.7rem;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
}

.as-empty-cell {
  color: var(--ss-text-subtle, #aaa);
}

/* ── States ── */

.as-skeleton-row {
  display: flex;
  gap: 1rem;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--ss-border);
}

.as-error {
  padding: 2rem;
  color: var(--ss-danger);
  text-align: center;
}

.as-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem 2rem;
  color: var(--ss-text-muted);
  text-align: center;
}
</style>
