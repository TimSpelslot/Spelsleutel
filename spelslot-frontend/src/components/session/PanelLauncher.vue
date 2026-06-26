<script setup lang="ts">
import type { PanelConfig } from '@/composables/usePanelLayout'
import { useI18n } from 'vue-i18n'

defineProps<{
  closedPanels: PanelConfig[]
  allPanels: PanelConfig[]
}>()

const emit = defineEmits<{
  open: [id: string]
  reset: []
}>()

const { t } = useI18n()
</script>

<template>
  <div class="launcher">
    <span class="launcher__label">
      <i class="pi pi-th-large" />
      {{ t('session.layout.panels') }}
    </span>

    <div class="launcher__divider" />

    <template v-if="closedPanels.length === 0">
      <span class="launcher__hint">{{ t('session.layout.allPanelsOpen') }}</span>
    </template>

    <template v-else>
      <span class="launcher__hint">{{ t('session.layout.closed') }}</span>
      <button
        v-for="p in closedPanels"
        :key="p.id"
        class="launcher__chip"
        :title="t('session.layout.restorePanel', { title: p.title })"
        @click="emit('open', p.id)"
      >
        <i :class="['pi', p.icon]" />
        {{ p.title }}
      </button>
    </template>

    <div class="launcher__spacer" />

    <button
      class="launcher__reset"
      :title="t('session.layout.resetLayoutTitle')"
      @click="emit('reset')"
    >
      <i class="pi pi-refresh" />
      {{ t('session.layout.resetLayout') }}
    </button>
  </div>
</template>

<style scoped>
.launcher {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 38px;
  background: var(--ss-shell);
  border-top: 1px solid color-mix(in srgb, var(--ss-primary) 50%, transparent);
  display: flex;
  align-items: center;
  padding: 0 0.75rem;
  gap: 0.5rem;
  z-index: 50;
}

.launcher__label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ss-shell-fg-muted);
  white-space: nowrap;
}

.launcher__label .pi {
  font-size: 0.75rem;
  color: var(--ss-primary);
}

.launcher__divider {
  width: 1px;
  height: 20px;
  background: color-mix(in srgb, var(--ss-shell-fg) 15%, transparent);
}

.launcher__hint {
  font-size: 0.68rem;
  color: var(--ss-shell-fg-muted);
  white-space: nowrap;
}

.launcher__chip {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.15rem 0.6rem;
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--ss-shell-fg-muted);
  background: color-mix(in srgb, var(--ss-shell-fg) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--ss-shell-fg) 16%, transparent);
  border-radius: 99px;
  cursor: pointer;
  transition:
    color 0.1s,
    background 0.1s,
    border-color 0.1s;
  white-space: nowrap;
}

.launcher__chip .pi {
  font-size: 0.65rem;
  color: var(--ss-primary);
}

.launcher__chip:hover {
  color: var(--ss-shell-fg);
  background: color-mix(in srgb, var(--ss-primary) 12%, transparent);
  border-color: color-mix(in srgb, var(--ss-primary) 35%, transparent);
}

.launcher__spacer {
  flex: 1;
}

.launcher__reset {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.65rem;
  color: var(--ss-shell-fg-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  transition: color 0.1s;
}

.launcher__reset:hover {
  color: var(--ss-shell-fg);
}
</style>
