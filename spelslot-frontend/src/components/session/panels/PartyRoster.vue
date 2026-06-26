<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Skeleton from 'primevue/skeleton'
import { adventureBoardService, type AbSession } from '@/services/adventureBoardService'

const props = defineProps<{
  sessionId: string | null
  abSessionId: number | null
}>()

// ── When a Codex session with a known AB session ID is selected,
//    load it directly. Otherwise show the manual dropdown.
const detail = ref<AbSession | null>(null)
const detailLoading = ref(false)
const detailError = ref<string | null>(null)
const activeTab = ref<'party' | 'waitlist'>('party')

async function loadById(id: number) {
  detailLoading.value = true
  detailError.value = null
  detail.value = null
  const result = await adventureBoardService.getSession(id)
  detailLoading.value = false
  if (result.type === 'ok') {
    detail.value = result.data
    activeTab.value = 'party'
  } else {
    detailError.value = result.message
  }
}

watch(
  () => props.abSessionId,
  (id) => {
    if (id) {
      loadById(id)
      selectedAbId.value = null // clear manual selection
    } else {
      detail.value = null
    }
  },
  { immediate: true },
)

// ── Manual dropdown (fallback when no abSessionId on the Codex entry) ────

const sessions = ref<AbSession[]>([])
const sessionsLoading = ref(false)
const selectedAbId = ref<number | null>(null)

const sessionOptions = computed(() =>
  sessions.value.map((s) => ({
    label: `${formatDate(s.date)} — ${s.title}`,
    value: s.id,
  })),
)

onMounted(async () => {
  // Only load the dropdown list when there's no auto-selected session
  if (props.abSessionId) return
  sessionsLoading.value = true
  const result = await adventureBoardService.getAllSessions()
  sessionsLoading.value = false
  if (result.type === 'ok') sessions.value = result.data
})

watch(selectedAbId, async (id) => {
  if (!id) return
  loadById(id)
})

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}
</script>

<template>
  <div class="roster">
    <!-- Manual session selector — only shown when no Codex session is selected -->
    <div v-if="!abSessionId" class="roster__selector">
      <Select
        v-model="selectedAbId"
        :options="sessionOptions"
        option-label="label"
        option-value="value"
        :loading="sessionsLoading"
        :placeholder="$t('session.roster.chooseSession')"
        show-clear
        class="roster__select"
        :empty-message="$t('session.roster.noSessionsFound')"
      />
    </div>

    <!-- No session selected -->
    <div v-if="!abSessionId && !selectedAbId" class="roster__empty">
      <i class="pi pi-users roster__empty-icon" />
      <p>{{ $t('session.roster.chooseSessionHint') }}</p>
    </div>

    <!-- Loading detail -->
    <template v-else-if="detailLoading">
      <div class="roster__skeletons">
        <Skeleton v-for="n in 4" :key="n" height="2rem" style="border-radius: 6px" />
      </div>
    </template>

    <!-- Error -->
    <div v-else-if="detailError" class="roster__empty roster__empty--error">
      <i class="pi pi-exclamation-circle roster__empty-icon" />
      <p>{{ detailError }}</p>
    </div>

    <!-- Party data -->
    <template v-else-if="detail">
      <!-- Stats bar -->
      <div class="roster__stats">
        <div class="roster__stat">
          <span class="roster__stat-val">{{ detail.party.length }}</span>
          <span class="roster__stat-label">{{ $t('common.assigned') }}</span>
        </div>
        <div class="roster__stat-divider" />
        <div class="roster__stat">
          <span class="roster__stat-val">{{ detail.maxPlayers }}</span>
          <span class="roster__stat-label">{{ $t('session.roster.max') }}</span>
        </div>
        <div class="roster__stat-divider" />
        <div class="roster__stat">
          <span
            class="roster__stat-val"
            :class="{ 'roster__stat-val--zero': detail.spotsLeft === 0 }"
            >{{ detail.spotsLeft }}</span
          >
          <span class="roster__stat-label">{{ $t('session.roster.free') }}</span>
        </div>
        <template v-if="detail.waitlist.length">
          <div class="roster__stat-divider" />
          <div class="roster__stat">
            <span class="roster__stat-val roster__stat-val--wait">{{
              detail.waitlist.length
            }}</span>
            <span class="roster__stat-label">{{ $t('session.roster.waiting') }}</span>
          </div>
        </template>
      </div>

      <!-- Tabs -->
      <div v-if="detail.waitlist.length" class="roster__tabs">
        <button
          class="roster__tab"
          :class="{ 'roster__tab--active': activeTab === 'party' }"
          @click="activeTab = 'party'"
        >
          <i class="pi pi-users" /> {{ $t('common.party') }}
        </button>
        <button
          class="roster__tab"
          :class="{ 'roster__tab--active': activeTab === 'waitlist' }"
          @click="activeTab = 'waitlist'"
        >
          <i class="pi pi-clock" />
          {{ $t('session.roster.waitingList', { count: detail.waitlist.length }) }}
        </button>
      </div>

      <!-- Party list -->
      <ul v-if="activeTab === 'party'" class="roster__list">
        <li v-if="detail.party.length === 0" class="roster__no-players">
          {{ $t('session.roster.noPlayersAssigned') }}
        </li>
        <li v-for="(player, i) in detail.party" :key="player.id" class="roster__player">
          <span class="roster__player-num">{{ i + 1 }}</span>
          <span class="roster__player-name">{{ player.displayName }}</span>
          <Tag
            v-if="player.appeared"
            :value="$t('common.present')"
            severity="success"
            class="roster__player-tag"
          />
        </li>
      </ul>

      <!-- Waitlist -->
      <ul v-else class="roster__list">
        <li
          v-for="(player, i) in detail.waitlist"
          :key="player.id"
          class="roster__player roster__player--waitlist"
        >
          <span class="roster__player-num roster__player-num--wait">{{ i + 1 }}</span>
          <span class="roster__player-name">{{ player.displayName }}</span>
        </li>
      </ul>

      <!-- Footer -->
      <div class="roster__footer">
        <span class="roster__footer-dm">
          <i class="pi pi-shield" />
          {{ detail.dmName }}
        </span>
        <Tag
          v-if="detail.isStoryAdventure"
          :value="$t('common.story')"
          severity="warn"
          class="roster__story-tag"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.roster {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* Selector */
.roster__selector {
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--ss-border);
  flex-shrink: 0;
}

.roster__select {
  width: 100%;
  font-size: 0.78rem !important;
}

/* Empty */
.roster__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  flex: 1;
  padding: 1rem;
  text-align: center;
  color: var(--ss-text-muted);
}

.roster__empty-icon {
  font-size: 1.75rem;
  opacity: 0.3;
}
.roster__empty p {
  margin: 0;
  font-size: 0.8rem;
}
.roster__empty--error .roster__empty-icon {
  color: var(--ss-danger);
  opacity: 1;
}

/* Skeletons */
.roster__skeletons {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.75rem;
  flex: 1;
}

/* Stats bar */
.roster__stats {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--ss-border);
  flex-shrink: 0;
}

.roster__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  flex: 1;
}

.roster__stat-val {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--ss-text);
  line-height: 1;
}

.roster__stat-val--zero {
  color: var(--ss-danger);
}
.roster__stat-val--wait {
  color: var(--ss-warning, #f59e0b);
}

.roster__stat-label {
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ss-text-muted);
}

.roster__stat-divider {
  width: 1px;
  height: 24px;
  background: var(--ss-border);
  margin: 0 0.25rem;
}

/* Tabs */
.roster__tabs {
  display: flex;
  border-bottom: 1px solid var(--ss-border);
  flex-shrink: 0;
}

.roster__tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  padding: 0.35rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--ss-text-muted);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition:
    color 0.1s,
    border-color 0.1s;
}

.roster__tab:hover {
  color: var(--ss-text);
}
.roster__tab--active {
  color: var(--ss-primary);
  border-bottom-color: var(--ss-primary);
}
.roster__tab .pi {
  font-size: 0.65rem;
}

/* Player list */
.roster__list {
  list-style: none;
  margin: 0;
  padding: 0.4rem 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  overflow-y: auto;
}

.roster__no-players {
  font-size: 0.8rem;
  color: var(--ss-text-muted);
  font-style: italic;
  text-align: center;
  padding: 1rem;
}

.roster__player {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.5rem;
  border-radius: 5px;
  background: var(--ss-parchment-dark);
}

.roster__player--waitlist {
  opacity: 0.7;
}

.roster__player-num {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--ss-primary) 15%, transparent);
  color: var(--ss-primary);
  font-size: 0.62rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.roster__player-num--wait {
  background: color-mix(in srgb, var(--ss-border) 80%, transparent);
  color: var(--ss-text-muted);
}

.roster__player-name {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--ss-text);
  flex: 1;
}

.roster__player-tag {
  font-size: 0.6rem !important;
}

/* Footer */
.roster__footer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  border-top: 1px solid var(--ss-border);
  background: var(--ss-parchment-dark);
  flex-shrink: 0;
}

.roster__footer-dm {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.72rem;
  color: var(--ss-text-muted);
  font-weight: 500;
  flex: 1;
}

.roster__footer-dm .pi {
  color: var(--ss-primary);
  font-size: 0.65rem;
}
.roster__story-tag {
  font-size: 0.6rem !important;
}
</style>
