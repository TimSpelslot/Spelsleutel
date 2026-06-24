<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Dialog from 'primevue/dialog'
import { adventureBoardService, type AbSession } from '@/services/adventureBoardService'
import { codexService } from '@/services/codexService'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { rankColor, rankLabel } from '@/utils/rank'
import DragonHeadSvg from '@/assets/spiked-dragon-head.svg?raw'
import DungeonGateSvg from '@/assets/dungeon-gate.svg?raw'
import DramaMasksSvg from '@/assets/drama-masks.svg?raw'

const auth = useAuthStore()
const router = useRouter()

const sessions = ref<AbSession[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const syncingSession = ref(false)
const canCreateSessionPage = computed(() =>
  !!selectedSession.value?.releaseAssignments &&
  auth.hasPermission(['DM', 'ADMIN']),
)

async function syncSessionPage() {
  if (!selectedSession.value) return
  syncingSession.value = true
  const result = await codexService.syncSession(selectedSession.value.id)
  syncingSession.value = false
  if (result.type === 'ok') {
    router.push({ name: 'codex-entry', params: { slug: result.data.slug } })
  }
}

const searchQuery = ref('')
const filterStoryOnly = ref(false)
const filterHasSpots = ref(false)

const selectedSession = ref<AbSession | null>(null)

onMounted(async () => {
  loading.value = true
  const result = await adventureBoardService.getAllSessions()
  loading.value = false
  if (result.type === 'ok') {
    sessions.value = result.data
  } else {
    error.value = result.message
  }
})

const filteredSessions = computed(() => {
  let list = sessions.value
  if (filterStoryOnly.value) list = list.filter((s) => s.isStoryAdventure)
  if (filterHasSpots.value) list = list.filter((s) => s.spotsLeft > 0)
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.dmName.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }
  return list
})

function openDetail(session: AbSession) {
  selectedSession.value = session
}

function closeDetail() {
  selectedSession.value = null
}

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatDay(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric' })
}

function formatMonth(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`)
    .toLocaleDateString('en-GB', { month: 'short' })
    .toUpperCase()
}


</script>

<template>
  <div class="ab-view">
    <div class="ab-view__header">
      <div>
        <h1 class="ab-view__title">
          <i class="pi pi-calendar" />
          Sessions
        </h1>
        <p class="ab-view__subtitle">Upcoming D&amp;D adventures via AdventureBoard</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="ab-filters">
      <div class="ab-filters__search-wrap">
        <i class="pi pi-search ab-filters__search-icon" aria-hidden="true" />
        <InputText
          v-model="searchQuery"
          placeholder="Search by title, DM or tag…"
          class="ab-filters__search"
        />
      </div>

      <button
        class="ab-filter-chip"
        :class="{ 'ab-filter-chip--active': filterStoryOnly }"
        @click="filterStoryOnly = !filterStoryOnly"
      >
        <i class="pi pi-star-fill" />
        Story
      </button>

      <button
        class="ab-filter-chip"
        :class="{ 'ab-filter-chip--active': filterHasSpots }"
        @click="filterHasSpots = !filterHasSpots"
      >
        <i class="pi pi-user-plus" />
        Open spots
      </button>

      <span v-if="!loading" class="ab-filters__count">
        {{ filteredSessions.length }} van {{ sessions.length }}
      </span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="ab-grid">
      <div v-for="n in 6" :key="n" class="ab-card ab-card--skeleton">
        <Skeleton width="3.5rem" height="3.75rem" />
        <div class="ab-card__body">
          <Skeleton height="1rem" style="margin-bottom:0.4rem" />
          <Skeleton height="0.75rem" width="60%" />
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="ab-empty ab-empty--error">
      <i class="pi pi-exclamation-circle ab-empty__icon" />
      <p>{{ error }}</p>
    </div>

    <!-- Empty filter result -->
    <div v-else-if="filteredSessions.length === 0" class="ab-empty">
      <i class="pi pi-filter-slash ab-empty__icon" />
      <p>No sessions found. Adjust the filters.</p>
    </div>

    <!-- Session grid -->
    <div v-else class="ab-grid">
      <button
        v-for="session in filteredSessions"
        :key="session.id"
        class="ab-card"
        @click="openDetail(session)"
      >
        <!-- Date block -->
        <div class="ab-card__date">
          <span class="ab-card__day">{{ formatDay(session.date) }}</span>
          <span class="ab-card__month">{{ formatMonth(session.date) }}</span>
        </div>

        <!-- Content -->
        <div class="ab-card__body">
          <div class="ab-card__top">
            <span class="ab-card__title">{{ session.title }}</span>
            <div class="ab-card__badges">
              <Tag
                v-if="session.isStoryAdventure"
                value="Story"
                severity="warn"
                class="ab-card__badge"
              />
              <Tag
                v-if="session.releaseAssignments"
                value="Assigned"
                severity="success"
                class="ab-card__badge"
              />
            </div>
          </div>

          <div class="ab-card__meta">
            <span class="ab-card__dm">
              <i class="pi pi-shield" />
              {{ session.dmName }}
            </span>
            <span class="ab-card__spots" :class="{ 'ab-card__spots--full': session.spotsLeft === 0 }">
              <i class="pi pi-users" />
              {{ session.party.length }}/{{ session.maxPlayers }}
              <span v-if="session.spotsLeft > 0"> · {{ session.spotsLeft }} free</span>
              <span v-else> · full</span>
            </span>
          </div>

          <p v-if="session.shortDescription" class="ab-card__desc">
            {{ session.shortDescription }}
          </p>

          <div class="ab-card__footer">
            <!-- Tags -->
            <div v-if="session.tags.length" class="ab-card__tags">
              <span v-for="tag in session.tags.slice(0, 3)" :key="tag" class="ab-tag">{{ tag }}</span>
            </div>

            <!-- Rank indicators -->
            <div class="ab-card__ranks">
              <span
                v-if="session.ranks.combat"
                class="ab-rank"
                :style="{ color: rankColor(session.ranks.combat) }"
                :title="`Combat: ${rankLabel(session.ranks.combat)}`"
              >
                <!-- eslint-disable-next-line vue/no-v-html -->
                <span class="ab-rank__icon" v-html="DragonHeadSvg" />
                {{ session.ranks.combat }}
              </span>
              <span
                v-if="session.ranks.exploration"
                class="ab-rank"
                :style="{ color: rankColor(session.ranks.exploration) }"
                :title="`Exploration: ${rankLabel(session.ranks.exploration)}`"
              >
                <!-- eslint-disable-next-line vue/no-v-html -->
                <span class="ab-rank__icon" v-html="DungeonGateSvg" />
                {{ session.ranks.exploration }}
              </span>
              <span
                v-if="session.ranks.roleplaying"
                class="ab-rank"
                :style="{ color: rankColor(session.ranks.roleplaying) }"
                :title="`Roleplaying: ${rankLabel(session.ranks.roleplaying)}`"
              >
                <!-- eslint-disable-next-line vue/no-v-html -->
                <span class="ab-rank__icon" v-html="DramaMasksSvg" />
                {{ session.ranks.roleplaying }}
              </span>
            </div>
          </div>
        </div>
      </button>
    </div>

    <!-- Session detail dialog -->
    <Dialog
      :visible="!!selectedSession"
      :header="selectedSession?.title ?? ''"
      :modal="true"
      :draggable="false"
      :dismissable-mask="true"
      class="ab-detail-dialog"
      @update:visible="closeDetail"
    >
      <template v-if="selectedSession">

        <!-- Party roster — first, it's the main reason to click -->
        <div class="ab-detail__section">
          <h3 class="ab-detail__section-title">
            <i class="pi pi-users" /> Party
            <span class="ab-detail__section-count">
              {{ selectedSession.party.length }}/{{ selectedSession.maxPlayers }}
              <span v-if="selectedSession.spotsLeft > 0" class="ab-detail__spots-free">
                · {{ selectedSession.spotsLeft }} open
              </span>
              <span v-else class="ab-detail__spots-full">· full</span>
            </span>
          </h3>
          <div v-if="selectedSession.party.length === 0" class="ab-detail__empty-list">
            No players assigned yet
          </div>
          <ul v-else class="ab-detail__player-list">
            <li
              v-for="player in selectedSession.party"
              :key="player.id"
              class="ab-detail__player"
            >
              <i class="pi pi-user ab-detail__player-icon" />
              <span class="ab-detail__player-name">{{ player.displayName }}</span>
              <Tag
                v-if="player.appeared"
                value="Present"
                severity="success"
                class="ab-detail__player-badge"
              />
            </li>
          </ul>
        </div>

        <!-- Waitlist -->
        <div v-if="selectedSession.waitlist.length" class="ab-detail__section">
          <h3 class="ab-detail__section-title">
            <i class="pi pi-clock" /> Waiting list
            <span class="ab-detail__section-count">{{ selectedSession.waitlist.length }}</span>
          </h3>
          <ul class="ab-detail__player-list">
            <li
              v-for="(player, i) in selectedSession.waitlist"
              :key="player.id"
              class="ab-detail__player ab-detail__player--waitlist"
            >
              <span class="ab-detail__waitlist-num">{{ i + 1 }}</span>
              <span class="ab-detail__player-name">{{ player.displayName }}</span>
            </li>
          </ul>
        </div>

        <!-- Session meta -->
        <div class="ab-detail__meta">
          <div class="ab-detail__meta-row">
            <i class="pi pi-calendar ab-detail__meta-icon" />
            <span>{{ formatDate(selectedSession.date) }}</span>
          </div>
          <div class="ab-detail__meta-row">
            <i class="pi pi-shield ab-detail__meta-icon" />
            <span>DM: <strong>{{ selectedSession.dmName }}</strong></span>
          </div>
          <div v-if="selectedSession.requestedRoom" class="ab-detail__meta-row">
            <i class="pi pi-building ab-detail__meta-icon" />
            <span>Room: {{ selectedSession.requestedRoom }}</span>
          </div>
          <div v-if="selectedSession.excludeFromKarma" class="ab-detail__meta-row">
            <i class="pi pi-info-circle ab-detail__meta-icon" />
            <span class="ab-detail__no-karma">Does not count towards karma</span>
          </div>
        </div>

        <!-- Badges -->
        <div class="ab-detail__badges">
          <Tag v-if="selectedSession.isStoryAdventure" value="Story Adventure" severity="warn" />
          <Tag v-if="selectedSession.releaseAssignments" value="Assigned" severity="success" />
          <Tag v-if="selectedSession.isWaitingList" value="Waiting list" severity="secondary" />
          <Tag v-if="selectedSession.numSessions > 1" :value="`${selectedSession.numSessions} sessions`" severity="info" />
        </div>

        <!-- Description -->
        <p v-if="selectedSession.shortDescription" class="ab-detail__desc">
          {{ selectedSession.shortDescription }}
        </p>

        <!-- Tags -->
        <div v-if="selectedSession.tags.length" class="ab-detail__tags">
          <span v-for="tag in selectedSession.tags" :key="tag" class="ab-tag">{{ tag }}</span>
        </div>

        <!-- Rank bars -->
        <div v-if="selectedSession.ranks.combat || selectedSession.ranks.exploration || selectedSession.ranks.roleplaying" class="ab-detail__ranks">
          <div class="ab-detail__rank-row">
            <span class="ab-detail__rank-label">
              <!-- eslint-disable-next-line vue/no-v-html -->
              <span class="ab-rank__icon" v-html="DragonHeadSvg" /> Combat
            </span>
            <div class="ab-detail__rank-bar">
              <div v-for="n in 3" :key="n" class="ab-detail__rank-pip" :class="{ 'ab-detail__rank-pip--on': n <= selectedSession.ranks.combat }" :style="n <= selectedSession.ranks.combat ? { background: rankColor(selectedSession.ranks.combat) } : {}" />
            </div>
            <span class="ab-detail__rank-text">{{ rankLabel(selectedSession.ranks.combat) }}</span>
          </div>
          <div class="ab-detail__rank-row">
            <span class="ab-detail__rank-label">
              <!-- eslint-disable-next-line vue/no-v-html -->
              <span class="ab-rank__icon" v-html="DungeonGateSvg" /> Exploration
            </span>
            <div class="ab-detail__rank-bar">
              <div v-for="n in 3" :key="n" class="ab-detail__rank-pip" :class="{ 'ab-detail__rank-pip--on': n <= selectedSession.ranks.exploration }" :style="n <= selectedSession.ranks.exploration ? { background: rankColor(selectedSession.ranks.exploration) } : {}" />
            </div>
            <span class="ab-detail__rank-text">{{ rankLabel(selectedSession.ranks.exploration) }}</span>
          </div>
          <div class="ab-detail__rank-row">
            <span class="ab-detail__rank-label">
              <!-- eslint-disable-next-line vue/no-v-html -->
              <span class="ab-rank__icon" v-html="DramaMasksSvg" /> Roleplaying
            </span>
            <div class="ab-detail__rank-bar">
              <div v-for="n in 3" :key="n" class="ab-detail__rank-pip" :class="{ 'ab-detail__rank-pip--on': n <= selectedSession.ranks.roleplaying }" :style="n <= selectedSession.ranks.roleplaying ? { background: rankColor(selectedSession.ranks.roleplaying) } : {}" />
            </div>
            <span class="ab-detail__rank-text">{{ rankLabel(selectedSession.ranks.roleplaying) }}</span>
          </div>
        </div>

      </template>

      <template #footer>
        <Button
          v-if="canCreateSessionPage"
          label="Create session page"
          icon="pi pi-book"
          :loading="syncingSession"
          severity="secondary"
          @click="syncSessionPage"
        />
        <Button label="Close" text @click="closeDetail" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.ab-view {
  max-width: 960px;
}

.ab-view__header {
  margin-bottom: 1.5rem;
}

.ab-view__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 0.25rem;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--ss-text);
}

.ab-view__title .pi { color: var(--ss-primary); }

.ab-view__subtitle {
  margin: 0;
  font-size: 0.85rem;
  color: var(--ss-text-muted);
}

/* ── Filters ── */
.ab-filters {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;
}

.ab-filters__search-wrap {
  position: relative;
  flex: 1;
  min-width: 200px;
  max-width: 320px;
}

.ab-filters__search-icon {
  position: absolute;
  left: 0.65rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.75rem;
  color: var(--ss-text-muted);
  pointer-events: none;
}

.ab-filters__search {
  width: 100%;
  padding-left: 2rem !important;
}

.ab-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--ss-border);
  border-radius: 99px;
  background: none;
  color: var(--ss-text-muted);
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.ab-filter-chip:hover {
  border-color: var(--ss-primary);
  color: var(--ss-primary);
}

.ab-filter-chip--active {
  background: color-mix(in srgb, var(--ss-primary) 12%, transparent);
  border-color: var(--ss-primary);
  color: var(--ss-primary);
}

.ab-filters__count {
  font-size: 0.75rem;
  color: var(--ss-text-muted);
  margin-left: auto;
}

/* ── Grid ── */
.ab-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.875rem;
}

/* ── Card ── */
.ab-card {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  padding: 0.875rem 1rem;
  background: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-left: 4px solid var(--ss-primary);
  border-radius: var(--ss-radius);
  box-shadow: var(--ss-shadow-sm);
  cursor: pointer;
  text-align: left;
  transition: box-shadow 0.15s, border-color 0.15s;
  width: 100%;
}

.ab-card:hover {
  box-shadow: var(--ss-shadow);
  border-left-color: var(--ss-primary);
}

.ab-card--skeleton {
  border-left-color: var(--ss-border);
  cursor: default;
}

/* Date block */
.ab-card__date {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 3.25rem;
  height: 3.5rem;
  background: var(--ss-parchment-dark);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  gap: 0.05rem;
}

.ab-card__day {
  font-size: 1.3rem;
  font-weight: 700;
  line-height: 1;
  color: var(--ss-primary);
}

.ab-card__month {
  font-size: 0.6rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--ss-text-muted);
}

/* Body */
.ab-card__body {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  flex: 1;
  min-width: 0;
}

.ab-card__top {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
}

.ab-card__title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ss-text);
  flex: 1;
  min-width: 0;
  line-height: 1.3;
}

.ab-card__badges {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.ab-card__badge {
  font-size: 0.62rem !important;
}

.ab-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.ab-card__dm,
.ab-card__spots {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--ss-text-muted);
}

.ab-card__dm .pi,
.ab-card__spots .pi { font-size: 0.65rem; }

.ab-card__spots--full { color: var(--ss-danger); }

.ab-card__desc {
  margin: 0;
  font-size: 0.75rem;
  color: var(--ss-text-muted);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ab-card__footer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.1rem;
}

.ab-card__tags {
  display: flex;
  gap: 0.2rem;
  flex-wrap: wrap;
  flex: 1;
}

.ab-tag {
  background: color-mix(in srgb, var(--ss-primary) 10%, transparent);
  color: var(--ss-primary);
  border: 1px solid color-mix(in srgb, var(--ss-primary) 22%, transparent);
  border-radius: 99px;
  padding: 0.05em 0.4em;
  font-size: 0.65rem;
  font-weight: 500;
}

.ab-card__ranks {
  display: flex;
  gap: 0.4rem;
  flex-shrink: 0;
}

.ab-rank {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  font-size: 0.65rem;
  color: var(--ss-text-muted);
  font-weight: 600;
}

.ab-rank__icon {
  display: inline-flex;
  align-items: center;
  width: 0.85em;
  height: 0.85em;
  flex-shrink: 0;
}

.ab-rank__icon svg {
  width: 100%;
  height: 100%;
  fill: currentColor;
}

/* ── Empty / error ── */
.ab-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  background: var(--ss-surface);
  border: 1px dashed var(--ss-border);
  border-radius: var(--ss-radius);
  text-align: center;
  color: var(--ss-text-muted);
}

.ab-empty__icon { font-size: 2rem; opacity: 0.4; }
.ab-empty p { margin: 0; font-size: 0.9rem; }
.ab-empty--error .ab-empty__icon { color: var(--ss-danger); opacity: 1; }

/* ── Detail dialog ── */
:global(.ab-detail-dialog) {
  width: min(560px, 95vw) !important;
}

.ab-detail__loading {
  padding: 0.5rem 0;
}

.ab-detail__meta {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  background: var(--ss-parchment-dark);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
}

.ab-detail__meta-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--ss-text);
}

.ab-detail__meta-icon {
  color: var(--ss-primary);
  font-size: 0.8rem;
  width: 0.8rem;
  flex-shrink: 0;
}

.ab-detail__spots-free { color: #22c55e; margin-left: 0.25em; font-size: 0.8em; }
.ab-detail__spots-full { color: var(--ss-danger); margin-left: 0.25em; font-size: 0.8em; }

.ab-detail__no-karma { color: var(--ss-text-muted); font-size: 0.85em; }

.ab-detail__badges {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.ab-detail__desc {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  color: var(--ss-text-muted);
  line-height: 1.6;
}

.ab-detail__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-bottom: 1rem;
}

/* Rank bars */
.ab-detail__ranks {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
  padding: 0.75rem 1rem;
  background: var(--ss-parchment-dark);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
}

.ab-detail__rank-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.ab-detail__rank-label {
  width: 110px;
  font-size: 0.78rem;
  color: var(--ss-text-muted);
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-shrink: 0;
}

.ab-detail__rank-bar {
  display: flex;
  gap: 3px;
  flex: 1;
}

.ab-detail__rank-pip {
  width: 18px;
  height: 8px;
  border-radius: 2px;
  background: var(--ss-border);
  transition: background 0.15s;
}

.ab-detail__rank-pip--on {
  background: var(--ss-primary);
}

.ab-detail__rank-text {
  font-size: 0.7rem;
  color: var(--ss-text-muted);
  width: 70px;
  text-align: right;
}

/* Section */
.ab-detail__section {
  margin-bottom: 1.25rem;
}

.ab-detail__section-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--ss-text-muted);
  margin: 0 0 0.6rem;
}

.ab-detail__section-title .pi { color: var(--ss-primary); }

.ab-detail__section-count {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  font-size: 0.78rem;
  margin-left: 0.35rem;
  color: var(--ss-text-muted);
}

.ab-detail__empty-list {
  font-size: 0.82rem;
  color: var(--ss-text-muted);
  font-style: italic;
  padding: 0.5rem 0;
}

.ab-detail__player-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.ab-detail__player {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.6rem;
  border-radius: var(--ss-radius-sm, 4px);
  background: var(--ss-parchment-dark);
}

.ab-detail__player--waitlist {
  opacity: 0.75;
}

.ab-detail__player-icon {
  color: var(--ss-text-muted);
  font-size: 0.7rem;
}

.ab-detail__player-name {
  font-size: 0.85rem;
  color: var(--ss-text);
  flex: 1;
}

.ab-detail__player-badge {
  font-size: 0.62rem !important;
}

.ab-detail__waitlist-num {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--ss-border);
  color: var(--ss-text-muted);
  font-size: 0.65rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

@media (max-width: 767px) {
  .ab-view { max-width: 100%; }
  .ab-grid { grid-template-columns: 1fr; }
}
</style>
