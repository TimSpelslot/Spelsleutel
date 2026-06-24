<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import { useAuthStore } from '@/stores/auth'
import { adventureBoardService, type UpcomingSession } from '@/services/adventureBoardService'
import { codexService, type CodexEntry } from '@/services/codexService'
import { authService } from '@/services/authService'
import { rankColor, rankLabel } from '@/utils/rank'
import DragonHeadSvg from '@/assets/spiked-dragon-head.svg?raw'
import DungeonGateSvg from '@/assets/dungeon-gate.svg?raw'
import DramaMasksSvg from '@/assets/drama-masks.svg?raw'

const router = useRouter()
const auth = useAuthStore()

// ── Sessions ──────────────────────────────────────────────────────────────
const sessions = ref<UpcomingSession[]>([])
const sessionsLoading = ref(false)
const sessionsError = ref<string | null>(null)

// ── Recent Codex ──────────────────────────────────────────────────────────
const recentEntries = ref<CodexEntry[]>([])
const codexLoading = ref(false)

// ── Worldbuilder request ──────────────────────────────────────────────────
const requestingWorldbuilder = ref(false)
const worldbuilderRequestSent = ref(false)

const showWorldbuilderBanner = computed(() => {
  const u = auth.effectiveUser
  if (!u) return false
  return u.role === 'PLAYER' && !u.isWorldbuilder && !u.worldbuilderRequestPending && !worldbuilderRequestSent.value
})

const showWorldbuilderPending = computed(() => {
  const u = auth.effectiveUser
  if (!u) return false
  return u.role === 'PLAYER' && !u.isWorldbuilder && (u.worldbuilderRequestPending || worldbuilderRequestSent.value)
})

async function requestWorldbuilder() {
  if (requestingWorldbuilder.value) return
  requestingWorldbuilder.value = true
  const result = await authService.requestWorldbuilder()
  requestingWorldbuilder.value = false
  if (result.type === 'ok') {
    auth.user = result.data
    worldbuilderRequestSent.value = true
  }
}

// ── Quick links ───────────────────────────────────────────────────────────
const quickLinks = computed(() => {
  const role = auth.effectiveUser?.role
  const links = [
    { name: 'codex', label: 'Codex', icon: 'pi pi-book', desc: 'Worldbuilding & lore' },
    { name: 'sessions', label: 'Sessions', icon: 'pi pi-calendar', desc: 'Upcoming adventures' },
    { name: 'marketplace', label: 'Marketplace', icon: 'pi pi-shopping-bag', desc: 'Magic items' },
    { name: 'session-player', label: 'Player Dashboard', icon: 'pi pi-play-circle', desc: 'Session view' },
  ]
  if (role === 'DM' || role === 'ADMIN') {
    links.push({ name: 'session-dm', label: 'DM Dashboard', icon: 'pi pi-shield', desc: 'Combat & management' })
  }
  if (role === 'ADMIN') {
    links.push({ name: 'admin', label: 'Admin', icon: 'pi pi-sliders-h', desc: 'User management' })
  }
  return links
})

// ── Entry type icons ──────────────────────────────────────────────────────
const TYPE_ICON: Record<string, string> = {
  lore: 'pi pi-star',
  location: 'pi pi-map-marker',
  npc: 'pi pi-user',
  faction: 'pi pi-users',
  item: 'pi pi-box',
  event: 'pi pi-bolt',
  rule: 'pi pi-info-circle',
  session: 'pi pi-play-circle',
}

function entryIcon(type: string) {
  return TYPE_ICON[type] ?? 'pi pi-file'
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ── Formatting ────────────────────────────────────────────────────────────
function formatDay(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric' })
}

function formatMonth(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`)
    .toLocaleDateString('en-GB', { month: 'short' })
    .toUpperCase()
}


// ── Role display ──────────────────────────────────────────────────────────
const ROLE_LABEL: Record<string, string> = { PLAYER: 'Player', DM: 'Dungeon Master', ADMIN: 'Admin' }
const ROLE_SEVERITY: Record<string, string> = { PLAYER: 'secondary', DM: 'warn', ADMIN: 'danger' }

const userRoleLabel = computed(() => ROLE_LABEL[auth.effectiveUser?.role ?? 'PLAYER'] ?? 'Player')
const userRoleSeverity = computed(() => ROLE_SEVERITY[auth.effectiveUser?.role ?? 'PLAYER'] ?? 'secondary')

// ── Load ──────────────────────────────────────────────────────────────────
onMounted(async () => {
  sessionsLoading.value = true
  codexLoading.value = true

  try {
    const [sessResult, codexResult] = await Promise.all([
      adventureBoardService.getUpcomingSessions(),
      codexService.listRecent(6),
    ])

    if (sessResult.type === 'ok') sessions.value = sessResult.data.slice(0, 3)
    else sessionsError.value = sessResult.message

    if (codexResult.type === 'ok') recentEntries.value = codexResult.data
  } catch (err) {
    sessionsError.value = err instanceof Error ? err.message : 'Unknown error'
  } finally {
    sessionsLoading.value = false
    codexLoading.value = false
  }
})
</script>

<template>
  <div class="dashboard">

    <!-- Welcome card -->
    <section class="welcome">
      <div class="welcome__body">
        <div class="welcome__info">
          <h1 class="welcome__name">
            Welcome back, {{ auth.user?.displayName ?? auth.user?.name ?? 'adventurer' }}!
          </h1>
          <div class="welcome__tags">
            <Tag :value="userRoleLabel" :severity="userRoleSeverity" />
            <Tag v-if="auth.effectiveUser?.isWorldbuilder" value="Worldbuilder" severity="info" />
          </div>
        </div>
      </div>

      <!-- Worldbuilder request banner -->
      <div v-if="showWorldbuilderBanner" class="worldbuilder-banner">
        <i class="pi pi-pencil worldbuilder-banner__icon" />
        <div class="worldbuilder-banner__text">
          <strong>Want to contribute to the Codex?</strong>
          Request worldbuilder access to create and edit new pages.
        </div>
        <Button
          label="Request access"
          size="small"
          :loading="requestingWorldbuilder"
          @click="requestWorldbuilder"
        />
      </div>

      <div v-if="showWorldbuilderPending" class="worldbuilder-banner worldbuilder-banner--pending">
        <i class="pi pi-clock worldbuilder-banner__icon" />
        <div class="worldbuilder-banner__text">
          <strong>Request submitted.</strong>
          An admin will review your worldbuilder access request.
        </div>
      </div>
    </section>

    <!-- Main grid -->
    <div class="dashboard__grid">

      <!-- Left: Upcoming sessions -->
      <section class="sessions">
        <h2 class="section-heading">
          <i class="pi pi-calendar" aria-hidden="true" />
          Upcoming sessions
        </h2>

        <div v-if="sessionsLoading" class="sessions__list" aria-busy="true">
          <div v-for="n in 3" :key="n" class="session-card session-card--skeleton">
            <Skeleton width="3.5rem" height="3.75rem" border-radius="var(--ss-radius)" />
            <div class="session-card__body">
              <Skeleton height="1rem" class="session-card__skel-title" />
              <Skeleton height="0.8rem" width="55%" />
            </div>
          </div>
        </div>

        <div v-else-if="sessionsError" class="state-empty state-empty--error">
          <i class="pi pi-exclamation-circle state-empty__icon" />
          <p class="state-empty__text">Failed to load sessions — {{ sessionsError }}</p>
        </div>

        <div v-else-if="sessions.length === 0" class="state-empty">
          <i class="pi pi-shield state-empty__icon" />
          <p class="state-empty__text">No upcoming sessions. Enjoy the downtime, adventurer.</p>
        </div>

        <div v-else class="sessions__list">
          <div
            v-for="session in sessions"
            :key="session.id"
            class="session-card"
            role="button"
            tabindex="0"
            @click="router.push({ name: 'sessions' })"
            @keydown.enter="router.push({ name: 'sessions' })"
          >
            <div class="session-card__date" aria-hidden="true">
              <span class="session-card__day">{{ formatDay(session.date) }}</span>
              <span class="session-card__month">{{ formatMonth(session.date) }}</span>
            </div>

            <div class="session-card__body">
              <div class="session-card__row">
                <span class="session-card__title">{{ session.title }}</span>
                <div class="session-card__badges">
                  <Tag
                    :value="session.status === 'assigned' ? 'Assigned' : 'Upcoming'"
                    :severity="session.status === 'assigned' ? 'success' : 'secondary'"
                    class="session-card__tag"
                  />
                  <Tag v-if="session.isStoryAdventure" value="Story" severity="warn" class="session-card__tag" />
                </div>
              </div>

              <div class="session-card__meta">
                <span class="session-card__dm">
                  <i class="pi pi-shield" />
                  {{ session.dmName ?? 'Unknown DM' }}
                </span>
                <span class="session-card__spots">
                  <i class="pi pi-users" />
                  {{ session.partySize }}/{{ session.maxPlayers }}
                  <span v-if="session.spotsLeft > 0" class="session-card__spots-free"> · {{ session.spotsLeft }} free</span>
                  <span v-else class="session-card__spots-full"> · full</span>
                </span>
              </div>

              <p v-if="session.shortDescription" class="session-card__desc">
                {{ session.shortDescription }}
              </p>

              <div class="session-card__footer">
                <div v-if="session.tags.length" class="session-card__tags">
                  <span v-for="tag in session.tags.slice(0, 2)" :key="tag" class="session-card__chip">{{ tag }}</span>
                </div>
                <div class="session-card__ranks">
                  <span v-if="session.ranks.combat" class="session-card__rank" :style="{ color: rankColor(session.ranks.combat) }" :title="`Combat: ${rankLabel(session.ranks.combat)}`">
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <span class="session-card__rank-icon" v-html="DragonHeadSvg" />
                  </span>
                  <span v-if="session.ranks.exploration" class="session-card__rank" :style="{ color: rankColor(session.ranks.exploration) }" :title="`Exploration: ${rankLabel(session.ranks.exploration)}`">
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <span class="session-card__rank-icon" v-html="DungeonGateSvg" />
                  </span>
                  <span v-if="session.ranks.roleplaying" class="session-card__rank" :style="{ color: rankColor(session.ranks.roleplaying) }" :title="`Roleplaying: ${rankLabel(session.ranks.roleplaying)}`">
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <span class="session-card__rank-icon" v-html="DramaMasksSvg" />
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button class="link-btn" @click="router.push({ name: 'sessions' })">
            View all sessions →
          </button>
        </div>
      </section>

      <!-- Right column -->
      <aside class="dashboard__aside">

        <!-- Quick links -->
        <section class="quick-links">
          <h2 class="section-heading">
            <i class="pi pi-th-large" />
            Quick links
          </h2>
          <div class="quick-links__grid">
            <button
              v-for="link in quickLinks"
              :key="link.name"
              class="quick-link"
              @click="router.push({ name: link.name })"
            >
              <i :class="['quick-link__icon', link.icon]" aria-hidden="true" />
              <span class="quick-link__label">{{ link.label }}</span>
              <span class="quick-link__desc">{{ link.desc }}</span>
            </button>
          </div>
        </section>

        <!-- Recent Codex -->
        <section class="recent-codex">
          <h2 class="section-heading">
            <i class="pi pi-book" />
            Recent Codex
          </h2>

          <div v-if="codexLoading" class="recent-codex__list">
            <div v-for="n in 4" :key="n" class="codex-row codex-row--skeleton">
              <Skeleton width="1rem" height="1rem" border-radius="50%" />
              <div style="flex:1">
                <Skeleton height="0.85rem" width="80%" />
              </div>
            </div>
          </div>

          <div v-else-if="recentEntries.length === 0" class="state-empty state-empty--sm">
            <p class="state-empty__text">No Codex entries yet.</p>
          </div>

          <div v-else class="recent-codex__list">
            <button
              v-for="entry in recentEntries"
              :key="entry.id"
              class="codex-row"
              @click="router.push({ name: 'codex-entry', params: { slug: entry.slug } })"
            >
              <i
                :class="['codex-row__icon', entryIcon(entry.type)]"
                :style="entry.iconColor ? { color: entry.iconColor } : {}"
                aria-hidden="true"
              />
              <div class="codex-row__body">
                <span class="codex-row__name">{{ entry.name }}</span>
                <span class="codex-row__meta">{{ timeAgo(entry.updatedAt) }}</span>
              </div>
              <Tag v-if="entry.permission === 'DM_ONLY'" value="DM" severity="warn" class="codex-row__tag" />
            </button>

            <button class="link-btn" @click="router.push({ name: 'codex' })">
              Open Codex →
            </button>
          </div>
        </section>

      </aside>
    </div>
  </div>
</template>

<style scoped>
/* ── Layout ── */
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 1100px;
}

.dashboard__grid {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 1.5rem;
  align-items: start;
}

.dashboard__aside {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* ── Section heading ── */
.section-heading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--ss-text);
  margin: 0 0 0.85rem;
  letter-spacing: 0.02em;
}

.section-heading .pi {
  color: var(--ss-primary);
  font-size: 0.9rem;
}

/* ── Welcome card ── */
.welcome {
  background-color: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-left: 4px solid var(--ss-primary);
  border-radius: var(--ss-radius);
  box-shadow: var(--ss-shadow-sm);
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.welcome__body {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.welcome__info {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.welcome__name {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--ss-text);
  margin: 0;
}

.welcome__tags {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

/* ── Worldbuilder banner ── */
.worldbuilder-banner {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  background-color: color-mix(in srgb, var(--ss-primary) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--ss-primary) 25%, transparent);
  border-radius: var(--ss-radius);
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
  color: var(--ss-text);
}

.worldbuilder-banner--pending {
  background-color: color-mix(in srgb, #3b82f6 8%, transparent);
  border-color: color-mix(in srgb, #3b82f6 25%, transparent);
}

.worldbuilder-banner__icon {
  color: var(--ss-primary);
  font-size: 1.1rem;
  flex-shrink: 0;
}

.worldbuilder-banner--pending .worldbuilder-banner__icon {
  color: #3b82f6;
}

.worldbuilder-banner__text {
  flex: 1;
  line-height: 1.4;
}

/* ── Sessions ── */
.sessions {
  background-color: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  box-shadow: var(--ss-shadow-sm);
  padding: 1.25rem;
}

.sessions__list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.session-card {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 0.85rem 1rem;
  background-color: color-mix(in srgb, var(--ss-parchment, #fdf8f0) 60%, var(--ss-surface));
  border: 1px solid var(--ss-border);
  border-left: 3px solid var(--ss-primary);
  border-radius: var(--ss-radius);
  transition: box-shadow 0.15s;
  cursor: pointer;
}

.session-card:hover { box-shadow: var(--ss-shadow); }
.session-card--skeleton { border-left-color: var(--ss-border); }

.session-card__date {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 3.25rem;
  height: 3.5rem;
  background-color: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
}

.session-card__day {
  font-size: 1.3rem;
  font-weight: 700;
  line-height: 1;
  color: var(--ss-primary);
}

.session-card__month {
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--ss-text-muted);
}

.session-card__body {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  flex: 1;
  min-width: 0;
}

.session-card__row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.session-card__title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ss-text);
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-card__tag { font-size: 0.67rem; flex-shrink: 0; }
.session-card__badges { display: flex; gap: 0.2rem; flex-shrink: 0; }
.session-card__meta { display: flex; flex-wrap: wrap; gap: 0.45rem; }

.session-card__dm,
.session-card__spots {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.76rem;
  color: var(--ss-text-muted);
}

.session-card__dm .pi,
.session-card__spots .pi { font-size: 0.7rem; }

.session-card__spots-free { color: #22c55e; }
.session-card__spots-full { color: var(--ss-danger); }

.session-card__desc {
  margin: 0;
  font-size: 0.73rem;
  color: var(--ss-text-muted);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.session-card__footer { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.session-card__tags { display: flex; gap: 0.2rem; flex: 1; }

.session-card__chip {
  background: color-mix(in srgb, var(--ss-primary) 10%, transparent);
  color: var(--ss-primary);
  border: 1px solid color-mix(in srgb, var(--ss-primary) 22%, transparent);
  border-radius: 99px;
  padding: 0.05em 0.4em;
  font-size: 0.63rem;
  font-weight: 500;
}

.session-card__ranks { display: flex; gap: 0.35rem; flex-shrink: 0; }
.session-card__rank-icon {
  display: inline-flex;
  align-items: center;
  width: 0.9em;
  height: 0.9em;
}
.session-card__rank-icon svg {
  width: 100%;
  height: 100%;
  fill: currentColor;
}

/* ── Quick links ── */
.quick-links {
  background-color: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  box-shadow: var(--ss-shadow-sm);
  padding: 1.25rem;
}

.quick-links__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.quick-link {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  padding: 0.7rem 0.8rem;
  background-color: color-mix(in srgb, var(--ss-parchment, #fdf8f0) 60%, var(--ss-surface));
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s, border-color 0.15s;
}

.quick-link:hover {
  background-color: color-mix(in srgb, var(--ss-primary) 8%, transparent);
  border-color: color-mix(in srgb, var(--ss-primary) 30%, transparent);
}

.quick-link__icon {
  font-size: 1rem;
  color: var(--ss-primary);
  margin-bottom: 0.15rem;
}

.quick-link__label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--ss-text);
}

.quick-link__desc {
  font-size: 0.7rem;
  color: var(--ss-text-muted);
  line-height: 1.3;
}

/* ── Recent Codex ── */
.recent-codex {
  background-color: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  box-shadow: var(--ss-shadow-sm);
  padding: 1.25rem;
}

.recent-codex__list {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.codex-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  border: none;
  background: none;
  text-align: left;
  width: 100%;
  transition: background-color 0.12s;
}

.codex-row:hover { background-color: color-mix(in srgb, var(--ss-primary) 7%, transparent); }
.codex-row--skeleton { cursor: default; }
.codex-row--skeleton:hover { background: none; }

.codex-row__icon {
  font-size: 0.85rem;
  color: var(--ss-text-muted);
  flex-shrink: 0;
  width: 1rem;
  text-align: center;
}

.codex-row__body {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  flex: 1;
  min-width: 0;
}

.codex-row__name {
  font-size: 0.83rem;
  font-weight: 500;
  color: var(--ss-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.codex-row__meta {
  font-size: 0.68rem;
  color: var(--ss-text-muted);
}

.codex-row__tag { font-size: 0.6rem; flex-shrink: 0; }

/* ── Shared utility ── */
.link-btn {
  background: none;
  border: none;
  color: var(--ss-primary);
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  text-align: right;
  width: 100%;
  opacity: 0.75;
  transition: opacity 0.1s;
  margin-top: 0.25rem;
}

.link-btn:hover { opacity: 1; }

/* ── Empty/error states ── */
.state-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 2rem;
  border: 1px dashed var(--ss-border);
  border-radius: var(--ss-radius);
  text-align: center;
}

.state-empty--sm { padding: 1rem; }
.state-empty--error .state-empty__icon { color: var(--ss-danger); }

.state-empty__icon { font-size: 1.75rem; color: var(--ss-text-muted); }
.state-empty__text { margin: 0; font-size: 0.85rem; color: var(--ss-text-muted); }

/* ── Responsive ── */
@media (max-width: 900px) {
  .dashboard__grid { grid-template-columns: 1fr; }
}

@media (max-width: 767px) {
  .dashboard { max-width: 100%; }
  .quick-links__grid { grid-template-columns: 1fr 1fr; }
  .welcome__name { font-size: 1.1rem; }
}
</style>
