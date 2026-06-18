<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Avatar from 'primevue/avatar'
import OverlayBadge from 'primevue/overlaybadge'
import Tag from 'primevue/tag'
import { useAuthStore } from '@/stores/auth'
import { useSidebar } from '@/composables/useSidebar'

const auth = useAuthStore()
const router = useRouter()
const sidebar = useSidebar()

const userInitials = computed(() => {
  const name = auth.user?.displayName ?? auth.user?.name ?? ''
  return name.charAt(0).toUpperCase() || '?'
})

const roleSeverity = computed(() => {
  switch (auth.user?.role) {
    case 'DM': return 'warn'
    case 'ADMIN': return 'contrast'
    default: return 'secondary'
  }
})

async function logout() {
  await auth.logout()
  await router.push('/login')
}
</script>

<template>
  <header class="navbar">
    <div class="navbar__start">
      <Button
        :icon="sidebar.mobileOpen ? 'pi pi-times' : 'pi pi-bars'"
        text
        rounded
        aria-label="Toggle sidebar"
        class="navbar__toggle"
        @click="sidebar.toggle()"
      />
      <div class="navbar__brand">
        <i class="pi pi-shield navbar__brand-icon" aria-hidden="true" />
        <span class="navbar__brand-name">Spelslot</span>
      </div>
    </div>

    <div class="navbar__end">
      <!-- Notification bell (static count for now) -->
      <OverlayBadge value="3" severity="danger" class="navbar__bell">
        <Button
          icon="pi pi-bell"
          text
          rounded
          aria-label="Notifications"
        />
      </OverlayBadge>

      <!-- User avatar -->
      <Avatar
        :image="auth.user?.avatarUrl ?? undefined"
        :label="auth.user?.avatarUrl ? undefined : userInitials"
        shape="circle"
        class="navbar__avatar"
      />

      <!-- User name + role (hidden on mobile) -->
      <div class="navbar__user" aria-hidden="false">
        <span class="navbar__display-name">
          {{ auth.user?.displayName ?? auth.user?.name }}
        </span>
        <Tag
          :value="auth.user?.role"
          :severity="roleSeverity"
          class="navbar__role-tag"
        />
      </div>

      <Button
        icon="pi pi-sign-out"
        text
        rounded
        aria-label="Sign out"
        class="navbar__logout"
        @click="logout"
      />
    </div>
  </header>
</template>

<style scoped>
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--ss-navbar-height);
  background-color: var(--ss-shell);
  border-bottom: 1px solid var(--ss-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.75rem 0 0.5rem;
  z-index: 100;
  gap: 0.5rem;
}

.navbar__start,
.navbar__end {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

/* Override PrimeVue text button colors inside the dark navbar */
.navbar :deep(.p-button-text) {
  color: var(--ss-shell-fg-muted);
}

.navbar :deep(.p-button-text:hover) {
  color: var(--ss-shell-fg);
  background-color: color-mix(in srgb, var(--ss-shell-fg) 8%, transparent);
}

.navbar__brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-left: 0.25rem;
  text-decoration: none;
}

.navbar__brand-icon {
  font-size: 1.1rem;
  color: var(--ss-primary);
}

.navbar__brand-name {
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ss-primary);
  user-select: none;
}

.navbar__bell {
  /* OverlayBadge wrapper */
}

.navbar__avatar {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  font-size: 0.85rem;
}

.navbar__user {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  line-height: 1;
}

.navbar__display-name {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--ss-shell-fg);
  white-space: nowrap;
}

.navbar__role-tag {
  font-size: 0.65rem;
  padding: 0.1rem 0.4rem;
}

@media (max-width: 767px) {
  .navbar__user {
    display: none;
  }

  .navbar__logout {
    display: none;
  }
}
</style>
