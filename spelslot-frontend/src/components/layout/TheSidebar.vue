<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Avatar from 'primevue/avatar'
import { useAuthStore } from '@/stores/auth'
import { useSidebar } from '@/composables/useSidebar'

const { t } = useI18n()
const auth = useAuthStore()
const sidebar = useSidebar()

const userInitials = computed(() => {
  const name = auth.user?.displayName ?? auth.user?.name ?? ''
  return name.charAt(0).toUpperCase() || '?'
})

type NavItem = { name: string; label: string; icon: string }

const navItems = computed<NavItem[]>(() => {
  const role = auth.effectiveUser?.role
  const items: NavItem[] = [
    { name: 'dashboard', label: t('nav.sidebar.dashboard'), icon: 'pi pi-home' },
    { name: 'codex', label: t('nav.sidebar.codex'), icon: 'pi pi-book' },
    { name: 'sessions', label: t('nav.sidebar.sessions'), icon: 'pi pi-calendar' },
    { name: 'session-player', label: t('nav.sidebar.session'), icon: 'pi pi-play-circle' },
    { name: 'marketplace', label: t('nav.sidebar.marketplace'), icon: 'pi pi-shopping-bag' },
  ]
  // DM Dashboard only for permanent DM/ADMIN roles.
  // Player-hosted sessions will add this link dynamically once AdventureBoard
  // integration is in place and we know who's running a given session.
  if (role === 'DM' || role === 'ADMIN') {
    items.push({ name: 'session-dm', label: t('nav.sidebar.dmDashboard'), icon: 'pi pi-shield' })
  }
  if (role === 'ADMIN') {
    items.push({ name: 'admin', label: t('nav.sidebar.admin'), icon: 'pi pi-sliders-h' })
  }
  return items
})
</script>

<template>
  <aside
    :class="[
      'sidebar',
      { 'sidebar--collapsed': sidebar.collapsed, 'sidebar--mobile-open': sidebar.mobileOpen },
    ]"
    :aria-label="$t('nav.sidebar.mainNavigation')"
  >
    <!-- Nav items -->
    <nav class="sidebar__nav">
      <RouterLink
        v-for="item in navItems"
        :key="item.name"
        v-tooltip.right="sidebar.collapsed ? item.label : undefined"
        :to="{ name: item.name }"
        :class="['sidebar__item']"
        @click="sidebar.closeMobile()"
      >
        <i :class="['sidebar__icon', item.icon]" aria-hidden="true" />
        <span class="sidebar__label">{{ item.label }}</span>
      </RouterLink>
    </nav>

    <!-- Divider -->
    <div class="sidebar__divider" aria-hidden="true" />

    <!-- User footer -->
    <div class="sidebar__footer">
      <Avatar
        :image="auth.user?.avatarUrl ?? undefined"
        :label="auth.user?.avatarUrl ? undefined : userInitials"
        shape="circle"
        class="sidebar__footer-avatar"
      />
      <div class="sidebar__footer-info">
        <span class="sidebar__footer-name">
          {{ auth.user?.displayName ?? auth.user?.name }}
        </span>
        <span class="sidebar__footer-role">{{ auth.user?.role }}</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
/* ── Base sidebar ── */
.sidebar {
  position: fixed;
  top: var(--ss-navbar-height);
  left: 0;
  bottom: 0;
  width: var(--ss-sidebar-width);
  background-color: var(--ss-shell-lighter);
  border-right: 1px solid color-mix(in srgb, var(--ss-primary) 20%, transparent);
  display: flex;
  flex-direction: column;
  z-index: 50;
  overflow: hidden;
  transition: width 0.25s ease;
}

.sidebar--collapsed {
  width: var(--ss-sidebar-collapsed-width);
}

/* ── Nav section ── */
.sidebar__nav {
  flex: 1;
  padding: 0.75rem 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.sidebar__item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 1rem;
  text-decoration: none;
  color: var(--ss-shell-fg-muted);
  font-size: 0.9rem;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 0.15s,
    color 0.15s,
    border-color 0.15s;
  border-left: 3px solid transparent;
  user-select: none;
}

.sidebar__item:hover {
  background-color: color-mix(in srgb, var(--ss-shell-fg) 6%, transparent);
  color: var(--ss-shell-fg);
}

/* Active route */
.sidebar__item.router-link-active {
  background-color: color-mix(in srgb, var(--ss-primary) 12%, transparent);
  color: var(--ss-primary);
  border-left-color: var(--ss-primary);
}

.sidebar__item--disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.sidebar__item--disabled:hover {
  background-color: transparent;
  color: var(--ss-shell-fg-muted);
}

.sidebar__icon {
  font-size: 1rem;
  width: 1rem;
  flex-shrink: 0;
}

.sidebar__label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar__coming-soon {
  margin-left: auto;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ss-text-subtle);
  background-color: color-mix(in srgb, var(--ss-shell-fg) 8%, transparent);
  padding: 0.1rem 0.35rem;
  border-radius: var(--ss-radius-sm);
}

/* ── Collapsed state ── */
.sidebar--collapsed .sidebar__item {
  justify-content: center;
  padding-left: 0;
  padding-right: 0;
  gap: 0;
}

.sidebar--collapsed .sidebar__label,
.sidebar--collapsed .sidebar__coming-soon {
  display: none;
}

/* ── Divider ── */
.sidebar__divider {
  height: 1px;
  margin: 0 1rem;
  background-color: color-mix(in srgb, var(--ss-shell-fg) 10%, transparent);
  flex-shrink: 0;
}

.sidebar--collapsed .sidebar__divider {
  margin: 0 0.5rem;
}

/* ── Footer (user mini-card) ── */
.sidebar__footer {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  overflow: hidden;
}

.sidebar--collapsed .sidebar__footer {
  justify-content: center;
  padding: 0.75rem 0;
}

.sidebar__footer-avatar {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  font-size: 0.85rem;
}

.sidebar__footer-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  overflow: hidden;
}

.sidebar--collapsed .sidebar__footer-info {
  display: none;
}

.sidebar__footer-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ss-shell-fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar__footer-role {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ss-shell-fg-muted);
}

/* ── Mobile ── */
@media (max-width: 767px) {
  .sidebar {
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    z-index: 200;
    /* Always full width on mobile regardless of collapsed state */
    width: var(--ss-sidebar-width);
  }

  .sidebar--collapsed {
    width: var(--ss-sidebar-width);
  }

  .sidebar--mobile-open {
    transform: translateX(0);
  }

  /* Always show labels on mobile (sidebar is never icon-only there) */
  .sidebar--collapsed .sidebar__item {
    justify-content: flex-start;
    padding-left: 1rem;
    padding-right: 1rem;
    gap: 0.75rem;
  }

  .sidebar--collapsed .sidebar__label,
  .sidebar--collapsed .sidebar__coming-soon {
    display: revert;
  }

  .sidebar--collapsed .sidebar__footer {
    justify-content: flex-start;
    padding: 0.75rem 1rem;
  }

  .sidebar--collapsed .sidebar__footer-info {
    display: flex;
  }
}
</style>
