<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Select from 'primevue/select'
import Button from 'primevue/button'
import FloatingPanel from '@/components/session/FloatingPanel.vue'
import PanelLauncher from '@/components/session/PanelLauncher.vue'
import CombatTracker from '@/components/session/panels/CombatTracker.vue'
import PartyRoster from '@/components/session/panels/PartyRoster.vue'
import SessionNotes from '@/components/session/panels/SessionNotes.vue'
import DmNotes from '@/components/session/panels/DmNotes.vue'
import MonsterStatBlock from '@/components/session/panels/MonsterStatBlock.vue'
import { usePanelLayout, type PanelConfig } from '@/composables/usePanelLayout'
import { codexService, type CodexEntry } from '@/services/codexService'

const router = useRouter()

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

const DM_PANELS: PanelConfig[] = [
  {
    id: 'combat',
    title: 'Combat Tracker',
    icon: 'pi-shield',
    defaultX: 20,
    defaultY: 60,
    defaultW: 380,
    defaultH: 520,
  },
  {
    id: 'roster',
    title: 'Party Roster',
    icon: 'pi-users',
    defaultX: 420,
    defaultY: 60,
    defaultW: 300,
    defaultH: 300,
  },
  {
    id: 'notes',
    title: 'Session Notes',
    icon: 'pi-file-edit',
    defaultX: 420,
    defaultY: 380,
    defaultW: 380,
    defaultH: 300,
  },
  {
    id: 'dm-notes',
    title: 'DM Notes',
    icon: 'pi-lock',
    defaultX: 20,
    defaultY: 600,
    defaultW: 380,
    defaultH: 260,
  },
  {
    id: 'monster',
    title: 'Monster Stat Block',
    icon: 'pi-book',
    defaultX: 820,
    defaultY: 60,
    defaultW: 320,
    defaultH: 560,
  },
]

const layout = usePanelLayout(DM_PANELS, 'spelslot-panel-layout-dm')

function resetLayout() {
  if (!confirm('Reset all panels to their default positions?')) return
  localStorage.removeItem('spelslot-panel-layout-dm')
  window.location.reload()
}
</script>

<template>
  <div class="sdm">

    <!-- ── Top bar ── -->
    <div class="sdm__topbar">
      <Button
        icon="pi pi-arrow-left"
        text
        size="small"
        class="sdm__back"
        label="Dashboard"
        @click="router.push('/dashboard')"
      />

      <div class="sdm__session-select">
        <label class="sdm__session-label">
          <i class="pi pi-play" /> Session:
        </label>
        <Select
          :model-value="selectedSessionId"
          :options="sessionOptions"
          option-label="label"
          option-value="value"
          placeholder="Select a session…"
          class="sdm__session-dropdown"
          show-clear
          @change="onSessionChange($event.value)"
        />
      </div>

      <div class="sdm__view-badge">
        <i class="pi pi-shield" />
        DM View
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
      <CombatTracker v-if="p.id === 'combat'" :session-id="selectedSessionId" />
      <PartyRoster v-else-if="p.id === 'roster'" :session-id="selectedSessionId" />
      <SessionNotes
        v-else-if="p.id === 'notes'"
        :key="activeDocId ?? 'no-session'"
        :session-id="selectedSessionId"
        :session-doc-id="activeDocId"
        :readonly="false"
      />
      <DmNotes v-else-if="p.id === 'dm-notes'" :session-id="selectedSessionId" />
      <MonsterStatBlock v-else-if="p.id === 'monster'" />
    </FloatingPanel>

    <!-- ── Panel launcher (bottom bar) ── -->
    <PanelLauncher
      :closed-panels="layout.closedPanels.value"
      :all-panels="DM_PANELS"
      @open="layout.open"
      @reset="resetLayout"
    />

  </div>
</template>

<style scoped>
.sdm {
  /* Escape AppLayout padding and fill viewport */
  margin: -1.5rem;
  height: calc(100vh - var(--ss-navbar-height));
  background: color-mix(in srgb, var(--ss-shell) 85%, var(--ss-parchment-dark));
  background-image:
    radial-gradient(ellipse at 20% 20%, color-mix(in srgb, var(--ss-primary) 4%, transparent) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 80%, color-mix(in srgb, var(--ss-primary) 3%, transparent) 0%, transparent 60%);
  position: relative;
  overflow: hidden;
}

/* ── Top bar ── */
.sdm__topbar {
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

.sdm__back {
  color: var(--ss-shell-fg-muted) !important;
  font-size: 0.78rem !important;
}

.sdm__session-select {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sdm__session-label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ss-shell-fg-muted);
  white-space: nowrap;
}

.sdm__session-label .pi { color: var(--ss-primary); font-size: 0.7rem; }

.sdm__session-dropdown {
  min-width: 220px;
  font-size: 0.82rem !important;
  height: 32px;
}

.sdm__view-badge {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ss-primary);
  opacity: 0.8;
}
</style>
