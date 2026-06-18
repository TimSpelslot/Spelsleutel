<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import { adventureBoardService, type UpcomingSession } from '@/services/adventureBoardService'

const sessions = ref<UpcomingSession[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

onMounted(async () => {
  loading.value = true
  const result = await adventureBoardService.getUpcomingSessions()
  loading.value = false
  if (result.type === 'ok') {
    sessions.value = result.data.slice(0, 3)
  } else {
    error.value = result.message
  }
})

function formatDay(dateStr: string): string {
  // Append noon to avoid UTC midnight shifting the date in local timezones
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric' })
}

function formatMonth(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`)
    .toLocaleDateString('nl-NL', { month: 'short' })
    .toUpperCase()
}
</script>

<template>
  <div class="dashboard">
    <!-- Upcoming Sessions -->
    <section class="sessions">
      <h2 class="sessions__heading">
        <i class="pi pi-calendar" aria-hidden="true" />
        Upcoming Sessions
      </h2>

      <!-- Loading skeletons -->
      <div v-if="loading" class="sessions__list" aria-busy="true" aria-label="Loading sessions">
        <div v-for="n in 3" :key="n" class="session-card session-card--skeleton">
          <Skeleton width="3.5rem" height="3.75rem" border-radius="var(--ss-radius)" />
          <div class="session-card__body">
            <Skeleton height="1rem" class="session-card__skel-title" />
            <Skeleton height="0.8rem" width="55%" />
          </div>
        </div>
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="sessions__empty sessions__empty--error">
        <i class="pi pi-exclamation-circle sessions__empty-icon" aria-hidden="true" />
        <p class="sessions__empty-text">Could not load sessions — {{ error }}</p>
      </div>

      <!-- Empty state -->
      <div v-else-if="sessions.length === 0" class="sessions__empty">
        <i class="pi pi-shield sessions__empty-icon" aria-hidden="true" />
        <p class="sessions__empty-text">No upcoming sessions. Enjoy the downtime, adventurer.</p>
      </div>

      <!-- Session cards -->
      <div v-else class="sessions__list">
        <div v-for="session in sessions" :key="session.id" class="session-card">
          <!-- Date block -->
          <div class="session-card__date" aria-hidden="true">
            <span class="session-card__day">{{ formatDay(session.date) }}</span>
            <span class="session-card__month">{{ formatMonth(session.date) }}</span>
          </div>

          <!-- Content -->
          <div class="session-card__body">
            <div class="session-card__row">
              <span class="session-card__title">{{ session.title }}</span>
              <Tag
                :value="session.status === 'assigned' ? 'Assigned' : 'Upcoming'"
                :severity="session.status === 'assigned' ? 'success' : 'secondary'"
                class="session-card__tag"
              />
            </div>
            <span class="session-card__dm">
              <i class="pi pi-user" aria-hidden="true" />
              {{ session.dmName ?? 'Unknown DM' }}
            </span>
            <span v-if="session.isStoryAdventure" class="session-card__story">
              <i class="pi pi-star-fill" aria-hidden="true" />
              Story Adventure
            </span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 720px;
}

/* ── Section heading ── */
.sessions__heading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--ss-text);
  margin: 0 0 1rem;
  letter-spacing: 0.02em;
}

.sessions__heading .pi {
  color: var(--ss-primary);
}

/* ── Card list ── */
.sessions__list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* ── Session card ── */
.session-card {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background-color: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-left: 4px solid var(--ss-primary);
  border-radius: var(--ss-radius);
  box-shadow: var(--ss-shadow-sm);
  transition: box-shadow 0.15s;
}

.session-card:hover {
  box-shadow: var(--ss-shadow);
}

.session-card--skeleton {
  border-left-color: var(--ss-border);
}

/* Date block */
.session-card__date {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 3.5rem;
  height: 3.75rem;
  background-color: var(--ss-parchment-dark);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  gap: 0.1rem;
}

.session-card__day {
  font-size: 1.4rem;
  font-weight: 700;
  line-height: 1;
  color: var(--ss-primary);
}

.session-card__month {
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--ss-text-muted);
}

/* Content */
.session-card__body {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex: 1;
  min-width: 0;
}

.session-card__row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.session-card__title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--ss-text);
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-card__tag {
  flex-shrink: 0;
  font-size: 0.7rem;
}

.session-card__dm {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: var(--ss-text-muted);
}

.session-card__dm .pi {
  font-size: 0.75rem;
}

.session-card__story {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: var(--ss-warning);
  font-weight: 500;
}

.session-card__story .pi {
  font-size: 0.65rem;
}

/* Skeleton overrides */
.session-card__skel-title {
  margin-bottom: 0.25rem;
}

/* ── Empty / error states ── */
.sessions__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2.5rem;
  background-color: var(--ss-surface);
  border: 1px dashed var(--ss-border);
  border-radius: var(--ss-radius);
  text-align: center;
}

.sessions__empty-icon {
  font-size: 2rem;
  color: var(--ss-text-subtle);
}

.sessions__empty-text {
  margin: 0;
  font-size: 0.9rem;
  color: var(--ss-text-muted);
}

.sessions__empty--error .sessions__empty-icon {
  color: var(--ss-danger);
}

@media (max-width: 767px) {
  .dashboard {
    max-width: 100%;
  }
}
</style>
