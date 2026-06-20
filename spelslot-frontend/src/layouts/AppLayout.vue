<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import TheNavbar from '@/components/layout/TheNavbar.vue'
import TheSidebar from '@/components/layout/TheSidebar.vue'
import { useSidebar } from '@/composables/useSidebar'
import { useFcm } from '@/composables/useFcm'

const sidebar = useSidebar()
const fcm = useFcm()

onMounted(() => fcm.init())
</script>

<template>
  <div class="app-layout">
    <TheNavbar />

    <Transition name="overlay-fade">
      <div
        v-if="sidebar.mobileOpen"
        class="sidebar-overlay"
        aria-hidden="true"
        @click="sidebar.closeMobile()"
      />
    </Transition>

    <div class="app-layout__body">
      <TheSidebar />
      <main
        :class="['app-layout__content', { 'is-sidebar-collapsed': sidebar.collapsed }]"
      >
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-layout__body {
  display: flex;
  flex: 1;
  padding-top: var(--ss-navbar-height);
}

.app-layout__content {
  flex: 1;
  min-width: 0;
  margin-left: var(--ss-sidebar-width);
  padding: 1.5rem;
  background-color: var(--ss-parchment);
  min-height: calc(100vh - var(--ss-navbar-height));
  transition: margin-left 0.25s ease;
}

.app-layout__content.is-sidebar-collapsed {
  margin-left: var(--ss-sidebar-collapsed-width);
}

/* Mobile overlay backdrop */
.sidebar-overlay {
  position: fixed;
  inset: 0;
  background-color: var(--ss-surface-overlay);
  z-index: 150;
}

.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 0.2s ease;
}

.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}

@media (max-width: 767px) {
  .app-layout__content,
  .app-layout__content.is-sidebar-collapsed {
    margin-left: 0;
  }
}
</style>
