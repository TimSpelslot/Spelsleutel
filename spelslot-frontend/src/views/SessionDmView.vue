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
import { useIsMobile } from '@/composables/useIsMobile'
import { codexService, type CodexEntry } from '@/services/codexService'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t } = useI18n()

// ── Session selection ─────────────────────────────────────────────────────

const sessions = ref<CodexEntry[]>([])
const selectedSessionId = ref<string | null>(null)
const selectedAbSessionId = ref<number | null>(null)
const sessionOptions = computed(() => sessions.value.map((s) => ({ label: s.name, value: s.id })))

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
  selectedAbSessionId.value = sessions.value.find((s) => s.id === id)?.abSessionId ?? null
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
    title: t('session.panels.combatTracker'),
    icon: 'pi-shield',
    defaultX: 20,
    defaultY: 60,
    defaultW: 380,
    defaultH: 520,
  },
  {
    id: 'roster',
    title: t('session.panels.partyRoster'),
    icon: 'pi-users',
    defaultX: 420,
    defaultY: 60,
    defaultW: 300,
    defaultH: 300,
  },
  {
    id: 'notes',
    title: t('session.panels.sessionNotes'),
    icon: 'pi-file-edit',
    defaultX: 420,
    defaultY: 380,
    defaultW: 380,
    defaultH: 300,
  },
  {
    id: 'dm-notes',
    title: t('session.panels.dmNotes'),
    icon: 'pi-lock',
    defaultX: 20,
    defaultY: 600,
    defaultW: 380,
    defaultH: 260,
  },
  {
    id: 'monster',
    title: t('session.panels.monsterStatBlock'),
    icon: 'pi-book',
    defaultX: 820,
    defaultY: 60,
    defaultW: 320,
    defaultH: 560,
  },
]

const layout = usePanelLayout(DM_PANELS, 'spelslot-panel-layout-dm')
const isMobile = useIsMobile()
const mobileTab = ref<string>('combat')

const MOBILE_TABS = [
  { id: 'combat', label: t('session.tabs.combat'), icon: 'pi-shield' },
  { id: 'roster', label: t('session.tabs.roster'), icon: 'pi-users' },
  { id: 'notes', label: t('session.tabs.notes'), icon: 'pi-file-edit' },
  { id: 'dm-notes', label: t('session.tabs.dmNotes'), icon: 'pi-lock' },
  { id: 'monster', label: t('session.tabs.monsters'), icon: 'pi-book' },
]

function resetLayout() {
  if (!confirm(t('session.layout.resetConfirm'))) return
  localStorage.removeItem('spelslot-panel-layout-dm')
  window.location.reload()
}
</script>

<template>
  <!-- ── Mobile tab view ── -->
  <div v-if="isMobile" class="sdm sdm--mobile">
    <div class="sdm__topbar sdm__topbar--mobile">
      <Button icon="pi pi-arrow-left" text size="small" @click="router.push('/dashboard')" />
      <Select
        :model-value="selectedSessionId"
        :options="sessionOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('session.session.selectPlaceholderShort')"
        class="sdm__session-dropdown sdm__session-dropdown--mobile"
        show-clear
        @change="onSessionChange($event.value)"
      />
      <span class="sdm__view-badge">{{ t('common.dm') }}</span>
    </div>

    <div class="sdm__mobile-tabs">
      <button
        v-for="tab in MOBILE_TABS"
        :key="tab.id"
        class="sdm__mobile-tab"
        :class="{ 'sdm__mobile-tab--active': mobileTab === tab.id }"
        @click="mobileTab = tab.id"
      >
        <i :class="`pi ${tab.icon}`" />
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <div class="sdm__mobile-content">
      <CombatTracker v-if="mobileTab === 'combat'" :session-id="selectedSessionId" />
      <PartyRoster
        v-else-if="mobileTab === 'roster'"
        :session-id="selectedSessionId"
        :ab-session-id="selectedAbSessionId"
      />
      <SessionNotes
        v-else-if="mobileTab === 'notes'"
        :key="activeDocId ?? 'no-session'"
        :session-id="selectedSessionId"
        :session-doc-id="activeDocId"
        :readonly="false"
      />
      <DmNotes v-else-if="mobileTab === 'dm-notes'" :session-id="selectedSessionId" />
      <MonsterStatBlock v-else-if="mobileTab === 'monster'" />
    </div>
  </div>

  <!-- ── Desktop floating panel view ── -->
  <div v-else class="sdm">
    <!-- ── Top bar ── -->
    <div class="sdm__topbar">
      <Button
        icon="pi pi-arrow-left"
        text
        size="small"
        class="sdm__back"
        :label="t('session.view.dashboard')"
        @click="router.push('/dashboard')"
      />

      <div class="sdm__session-select">
        <label class="sdm__session-label">
          <i class="pi pi-play" /> {{ t('session.session.label') }}
        </label>
        <Select
          :model-value="selectedSessionId"
          :options="sessionOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('session.session.selectPlaceholder')"
          class="sdm__session-dropdown"
          show-clear
          @change="onSessionChange($event.value)"
        />
      </div>

      <div class="sdm__view-badge">
        <i class="pi pi-shield" />
        {{ t('session.view.dmView') }}
      </div>
    </div>

    <!-- ── Floating panels ── -->
    <FloatingPanel
      v-for="p in layout.visiblePanels.value"
      :id="p.id"
      :key="p.id"
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
      <PartyRoster
        v-else-if="p.id === 'roster'"
        :session-id="selectedSessionId"
        :ab-session-id="selectedAbSessionId"
      />
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
    radial-gradient(
      ellipse at 20% 20%,
      color-mix(in srgb, var(--ss-primary) 4%, transparent) 0%,
      transparent 60%
    ),
    radial-gradient(
      ellipse at 80% 80%,
      color-mix(in srgb, var(--ss-primary) 3%, transparent) 0%,
      transparent 60%
    );
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

.sdm__session-label .pi {
  color: var(--ss-primary);
  font-size: 0.7rem;
}

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

/* ── Mobile layout ── */
.sdm--mobile {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--ss-navbar-height));
  overflow: hidden;
}

.sdm__topbar--mobile {
  gap: 0.5rem;
}

.sdm__session-dropdown--mobile {
  flex: 1;
  min-width: 0;
}

.sdm__mobile-tabs {
  display: flex;
  background: var(--ss-shell);
  border-bottom: 1px solid color-mix(in srgb, var(--ss-primary) 25%, transparent);
  overflow-x: auto;
  scrollbar-width: none;
  flex-shrink: 0;
}
.sdm__mobile-tabs::-webkit-scrollbar {
  display: none;
}

.sdm__mobile-tab {
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
  transition:
    color 0.15s,
    border-color 0.15s;
  white-space: nowrap;
}
.sdm__mobile-tab .pi {
  font-size: 1rem;
}
.sdm__mobile-tab--active {
  color: var(--ss-primary);
  border-bottom-color: var(--ss-primary);
}

.sdm__mobile-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--ss-parchment);
}
</style>
