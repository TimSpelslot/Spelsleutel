<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Select from 'primevue/select'
import Button from 'primevue/button'
import FloatingPanel from '@/components/session/FloatingPanel.vue'
import PanelLauncher from '@/components/session/PanelLauncher.vue'
import PartyRoster from '@/components/session/panels/PartyRoster.vue'
import SessionNotes from '@/components/session/panels/SessionNotes.vue'
import MyNotes from '@/components/session/panels/MyNotes.vue'
import { usePanelLayout, type PanelConfig } from '@/composables/usePanelLayout'
import { useIsMobile } from '@/composables/useIsMobile'
import { codexService, type CodexEntry } from '@/services/codexService'
import CharacterSheet from '@/components/session/panels/CharacterSheet.vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const characterId = computed(() => {
  const raw = auth.user?.dndbeyondCharacterId
  if (!raw) return null
  const urlMatch = raw.match(/dndbeyond\.com\/characters\/(\d+)/i)
  return urlMatch ? urlMatch[1] : raw
})

// ── Session selection ─────────────────────────────────────────────────────

const sessions = ref<CodexEntry[]>([])
const selectedSessionId = ref<string | null>(null)
const sessionOptions = computed(() =>
  sessions.value.map((s) => ({ label: s.name, value: s.id })),
)

const sessionDocIds = ref<Record<string, string>>({})

const activeDocId = computed(() =>
  selectedSessionId.value ? (sessionDocIds.value[selectedSessionId.value] ?? null) : null,
)

// AdventureBoard session id for the selected session — PartyRoster requires it
// (null falls back to its manual session picker). Mirrors SessionDmView.
const selectedAbSessionId = computed<number | null>(() =>
  selectedSessionId.value
    ? (sessions.value.find((s) => s.id === selectedSessionId.value)?.abSessionId ?? null)
    : null,
)

onMounted(async () => {
  const result = await codexService.listEntries()
  if (result.type === 'ok') {
    sessions.value = result.data.filter((e) => e.type === 'session')
  }
})

async function onSessionChange(id: string | null) {
  selectedSessionId.value = id
  if (!id || sessionDocIds.value[id]) return
  const detail = await codexService.getById(id)
  if (detail.type === 'ok') {
    const firstPage = detail.data.documents.find((d) => d.type === 'page')
    if (firstPage) sessionDocIds.value[id] = firstPage.id
  }
}

// ── Panel layout ──────────────────────────────────────────────────────────

const PLAYER_PANELS: PanelConfig[] = [
  {
    id: 'roster',
    title: 'Party Roster',
    icon: 'pi-users',
    defaultX: 20,
    defaultY: 60,
    defaultW: 300,
    defaultH: 340,
  },
  {
    id: 'notes',
    title: 'Session Notes',
    icon: 'pi-file-edit',
    defaultX: 340,
    defaultY: 60,
    defaultW: 400,
    defaultH: 360,
  },
  {
    id: 'my-notes',
    title: 'My Notes',
    icon: 'pi-pencil',
    defaultX: 20,
    defaultY: 420,
    defaultW: 400,
    defaultH: 280,
  },
  {
    id: 'character',
    title: 'Character Sheet',
    icon: 'pi-user',
    defaultX: 760,
    defaultY: 60,
    defaultW: 300,
    defaultH: 420,
  },
]

const layout = usePanelLayout(PLAYER_PANELS, 'spelslot-panel-layout-player')
const isMobile = useIsMobile()
const mobileTab = ref<string>('character')

const MOBILE_TABS = [
  { id: 'character', label: 'Character', icon: 'pi-user' },
  { id: 'roster',    label: 'Party',     icon: 'pi-users' },
  { id: 'notes',     label: 'Session',   icon: 'pi-file-edit' },
  { id: 'my-notes',  label: 'My Notes',  icon: 'pi-pencil' },
]

function resetLayout() {
  if (!confirm('Reset all panels to their default positions?')) return
  localStorage.removeItem('spelslot-panel-layout-player')
  window.location.reload()
}
</script>

<template>
  <!-- ── Mobile tab view ── -->
  <div v-if="isMobile" class="spv spv--mobile">
    <div class="spv__topbar spv__topbar--mobile">
      <Button icon="pi pi-arrow-left" text size="small" @click="router.push('/dashboard')" />
      <Select
        :model-value="selectedSessionId"
        :options="sessionOptions"
        option-label="label"
        option-value="value"
        placeholder="Select session…"
        class="spv__session-dropdown spv__session-dropdown--mobile"
        show-clear
        @change="onSessionChange($event.value)"
      />
      <span class="spv__view-badge">Player</span>
    </div>

    <div class="spv__mobile-tabs">
      <button
        v-for="tab in MOBILE_TABS"
        :key="tab.id"
        class="spv__mobile-tab"
        :class="{ 'spv__mobile-tab--active': mobileTab === tab.id }"
        @click="mobileTab = tab.id"
      >
        <i :class="`pi ${tab.icon}`" />
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <div class="spv__mobile-content">
      <CharacterSheet v-if="mobileTab === 'character'" :character-id="characterId" />
      <PartyRoster v-else-if="mobileTab === 'roster'" :session-id="selectedSessionId" :ab-session-id="selectedAbSessionId" />
      <SessionNotes
        v-else-if="mobileTab === 'notes'"
        :key="activeDocId ?? 'no-session'"
        :session-id="selectedSessionId"
        :session-doc-id="activeDocId"
        :readonly="false"
      />
      <MyNotes v-else-if="mobileTab === 'my-notes'" :session-id="selectedSessionId" />
    </div>
  </div>

  <!-- ── Desktop floating panel view ── -->
  <div v-else class="spv">

    <!-- ── Top bar ── -->
    <div class="spv__topbar">
      <Button
        icon="pi pi-arrow-left"
        text
        size="small"
        class="spv__back"
        label="Dashboard"
        @click="router.push('/dashboard')"
      />

      <div class="spv__session-select">
        <label class="spv__session-label">
          <i class="pi pi-play" /> Session:
        </label>
        <Select
          :model-value="selectedSessionId"
          :options="sessionOptions"
          option-label="label"
          option-value="value"
          placeholder="Select a session…"
          class="spv__session-dropdown"
          show-clear
          @change="onSessionChange($event.value)"
        />
      </div>

      <div class="spv__view-badge">
        <i class="pi pi-user" />
        Player View
      </div>
    </div>

    <!-- ── Floating panels ── -->
    <FloatingPanel
      v-for="p in layout.visiblePanels.value"
      :key="p.id"
      :id="p.id"
      :title="p.title"
      :icon="p.icon"
      :x="layout.states.value[p.id].x"
      :y="layout.states.value[p.id].y + 50"
      :width="layout.states.value[p.id].w"
      :height="layout.states.value[p.id].h"
      :minimized="layout.states.value[p.id].minimized"
      :z-index="layout.states.value[p.id].zIndex"
      @move="(x, y) => layout.move(p.id, x, y - 50)"
      @resize="(w, h) => layout.resize(p.id, w, h)"
      @move-and-resize="(x, y, w, h) => layout.moveAndResize(p.id, x, y - 50, w, h)"
      @minimize="layout.toggleMinimize(p.id)"
      @close="layout.close(p.id)"
      @focus="layout.focus(p.id)"
    >
      <PartyRoster v-if="p.id === 'roster'" :session-id="selectedSessionId" :ab-session-id="selectedAbSessionId" />
      <SessionNotes
        v-else-if="p.id === 'notes'"
        :key="activeDocId ?? 'no-session'"
        :session-id="selectedSessionId"
        :session-doc-id="activeDocId"
        :readonly="false"
      />
      <MyNotes v-else-if="p.id === 'my-notes'" :session-id="selectedSessionId" />
      <CharacterSheet v-else-if="p.id === 'character'" :character-id="characterId" />
    </FloatingPanel>

    <!-- ── Panel launcher (bottom bar) ── -->
    <PanelLauncher
      :closed-panels="layout.closedPanels.value"
      :all-panels="PLAYER_PANELS"
      @open="layout.open"
      @reset="resetLayout"
    />

  </div>
</template>

<style scoped>
.spv {
  margin: -1.5rem;
  height: calc(100vh - var(--ss-navbar-height));
  background: color-mix(in srgb, var(--ss-shell) 85%, var(--ss-parchment-dark));
  background-image:
    radial-gradient(ellipse at 30% 30%, color-mix(in srgb, var(--ss-primary) 3%, transparent) 0%, transparent 55%),
    radial-gradient(ellipse at 70% 70%, color-mix(in srgb, var(--ss-primary) 2%, transparent) 0%, transparent 55%);
  position: relative;
  overflow: hidden;
}

.spv__topbar {
  position: relative;
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  height: 50px;
  padding: 0 1rem;
  background: var(--ss-shell);
  border-bottom: 1px solid color-mix(in srgb, var(--ss-primary) 40%, transparent);
}

.spv__back {
  color: var(--ss-shell-fg-muted) !important;
  font-size: 0.78rem !important;
}

.spv__session-select {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.spv__session-label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ss-shell-fg-muted);
  white-space: nowrap;
}

.spv__session-label .pi { color: var(--ss-primary); font-size: 0.7rem; }

.spv__session-dropdown {
  min-width: 220px;
  font-size: 0.82rem !important;
  height: 32px;
}

.spv__view-badge {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ss-shell-fg-muted);
  opacity: 0.8;
}

/* ── Mobile layout ── */
.spv--mobile {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--ss-navbar-height));
  overflow: hidden;
}

.spv__topbar--mobile {
  gap: 0.5rem;
}

.spv__session-dropdown--mobile {
  flex: 1;
  min-width: 0;
}

.spv__mobile-tabs {
  display: flex;
  background: var(--ss-shell);
  border-bottom: 1px solid color-mix(in srgb, var(--ss-primary) 25%, transparent);
  overflow-x: auto;
  scrollbar-width: none;
  flex-shrink: 0;
}
.spv__mobile-tabs::-webkit-scrollbar { display: none; }

.spv__mobile-tab {
  flex: 1;
  min-width: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.5rem 0.25rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  color: var(--ss-shell-fg-muted);
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;
}
.spv__mobile-tab .pi { font-size: 1rem; }
.spv__mobile-tab--active {
  color: var(--ss-primary);
  border-bottom-color: var(--ss-primary);
}

.spv__mobile-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--ss-parchment);
}
</style>
