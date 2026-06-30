<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { SUPPORTED_LOCALES, setLocale } from '@/i18n'
import Button from 'primevue/button'
import Avatar from 'primevue/avatar'
import OverlayBadge from 'primevue/overlaybadge'
import Popover from 'primevue/popover'
import Tag from 'primevue/tag'
import { useAuthStore } from '@/stores/auth'
import { useSidebar } from '@/composables/useSidebar'
import { useColorScheme } from '@/composables/useColorScheme'
import { useNotificationsStore } from '@/stores/notifications'
import type { UserRole } from '@/types'

const { t, locale } = useI18n()
const auth = useAuthStore()
const router = useRouter()
const sidebar = useSidebar()
const colorScheme = useColorScheme()
const notifs = useNotificationsStore()

const bellPopover = ref()

// Switching is a straight toggle between the two supported locales.
const currentLocale = computed(
  () => SUPPORTED_LOCALES.find((l) => l.code === locale.value) ?? SUPPORTED_LOCALES[0],
)
const nextLocale = computed(
  () => SUPPORTED_LOCALES.find((l) => l.code !== locale.value) ?? SUPPORTED_LOCALES[0],
)

function toggleLang() {
  setLocale(nextLocale.value.code)
}

function toggleBell(event: MouseEvent) {
  bellPopover.value?.toggle(event)
}

async function handleNotifClick(id: string, href?: string) {
  await notifs.markRead(id)
  bellPopover.value?.hide()
  if (href) router.push(href)
}

onMounted(() => notifs.startPolling())
onUnmounted(() => notifs.stopPolling())

const TYPE_ICONS: Record<string, string> = {
  signup: 'pi-calendar-plus',
  assignment: 'pi-shield',
  marketplace: 'pi-shopping-bag',
  session: 'pi-book',
  system: 'pi-info-circle',
}

function typeIcon(type: string) {
  return `pi ${TYPE_ICONS[type] ?? 'pi-bell'}`
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return t('common.justNow')
  if (m < 60) return t('nav.timeAgo.minutes', { m })
  const h = Math.floor(m / 60)
  if (h < 24) return t('nav.timeAgo.hours', { h })
  return t('nav.timeAgo.days', { d: Math.floor(h / 24) })
}

const VIEW_ROLES = computed<{ role: UserRole; label: string }[]>(() => [
  { role: 'ADMIN', label: t('admin.roles.admin') },
  { role: 'PLAYER', label: t('admin.roles.player') },
])

const userInitials = computed(() => {
  const name = auth.user?.displayName ?? auth.user?.name ?? ''
  return name.charAt(0).toUpperCase() || '?'
})

const roleSeverity = computed(() => {
  switch (auth.effectiveUser?.role) {
    case 'ADMIN':
      return 'contrast'
    default:
      return 'secondary'
  }
})

function toggleView(role: UserRole) {
  if (auth.effectiveUser?.role !== role) auth.switchRole(role)
}

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
        :aria-label="$t('nav.toggleSidebar')"
        class="navbar__toggle"
        @click="sidebar.toggle()"
      />
      <div class="navbar__brand">
        <i class="pi pi-shield navbar__brand-icon" aria-hidden="true" />
        <span class="navbar__brand-name">{{ $t('nav.brand') }}</span>
      </div>
    </div>

    <!-- Dev view toggles (centre of navbar) -->
    <div class="navbar__view-toggles" :title="$t('nav.devSimulate')">
      <button
        v-for="v in VIEW_ROLES"
        :key="v.role"
        class="view-pill"
        :class="{ 'view-pill--active': auth.effectiveUser?.role === v.role }"
        @click="toggleView(v.role)"
      >
        {{ v.label }}
      </button>
      <span class="view-divider" />
      <button
        class="view-pill"
        :class="{ 'view-pill--active': auth.effectiveUser?.isStoryDm }"
        @click="auth.toggleFlag('isStoryDm')"
      >
        Story DM
      </button>
      <button
        class="view-pill"
        :class="{ 'view-pill--active': auth.effectiveUser?.isWorldbuilder }"
        @click="auth.toggleFlag('isWorldbuilder')"
      >
        Worldbuilder
      </button>
    </div>

    <div class="navbar__end">
      <!-- Language toggle (EN ⇄ NL) -->
      <Button
        text
        rounded
        class="navbar__lang-toggle"
        :aria-label="$t('nav.switchToLanguage', { language: nextLocale.label })"
        :title="$t('nav.switchToLanguage', { language: nextLocale.label })"
        @click="toggleLang"
      >
        <span class="navbar__lang-code">{{ currentLocale.code.toUpperCase() }}</span>
      </Button>

      <!-- Light / dark mode toggle -->
      <Button
        :icon="colorScheme.isDark ? 'pi pi-sun' : 'pi pi-moon'"
        text
        rounded
        :aria-label="colorScheme.isDark ? $t('nav.switchToLight') : $t('nav.switchToDark')"
        :title="colorScheme.isDark ? $t('nav.lightMode') : $t('nav.darkMode')"
        class="navbar__theme-toggle"
        @click="colorScheme.toggle()"
      />

      <!-- Notification bell -->
      <OverlayBadge
        :value="notifs.unreadCount > 0 ? String(notifs.unreadCount) : undefined"
        severity="danger"
        class="navbar__bell"
      >
        <Button
          icon="pi pi-bell"
          text
          rounded
          :aria-label="$t('nav.notifications')"
          @click="toggleBell"
        />
      </OverlayBadge>

      <Popover ref="bellPopover" class="notif-popover">
        <div class="notif-popover__header">
          <span class="notif-popover__heading">{{ $t('nav.popover.heading') }}</span>
          <Button
            v-if="notifs.unreadCount > 0"
            :label="$t('common.markAllRead')"
            text
            size="small"
            class="notif-popover__read-all"
            @click="notifs.markAllRead()"
          />
        </div>

        <ul class="notif-popover__list">
          <li
            v-for="n in notifs.notifications.slice(0, 8)"
            :key="n._id"
            class="notif-popover__item"
            :class="{
              'notif-popover__item--unread': !n.read,
              'notif-popover__item--clickable': !!n.href,
            }"
            @click="handleNotifClick(n._id, n.href)"
          >
            <i :class="['notif-popover__icon', typeIcon(n.type)]" />
            <div class="notif-popover__body">
              <p class="notif-popover__title">{{ n.title }}</p>
              <p class="notif-popover__msg">{{ n.message }}</p>
            </div>
            <span class="notif-popover__time">{{ timeAgo(n.createdAt) }}</span>
            <span v-if="!n.read" class="notif-popover__dot" />
          </li>
          <li v-if="notifs.notifications.length === 0" class="notif-popover__empty">
            {{ $t('common.noNotifications') }}
          </li>
        </ul>

        <div class="notif-popover__footer">
          <RouterLink
            :to="{ name: 'notifications' }"
            class="notif-popover__all-link"
            @click="bellPopover?.hide()"
          >
            {{ $t('nav.popover.viewAll') }}
            <i class="pi pi-arrow-right" />
          </RouterLink>
        </div>
      </Popover>

      <!-- User avatar -->
      <Avatar
        :image="auth.user?.avatarUrl ?? undefined"
        :label="auth.user?.avatarUrl ? undefined : userInitials"
        shape="circle"
        class="navbar__avatar"
        style="cursor: pointer"
        :title="$t('nav.profile')"
        @click="router.push('/profile')"
      />

      <!-- User name + role (hidden on mobile) -->
      <div class="navbar__user" aria-hidden="false">
        <span class="navbar__display-name">
          {{ auth.user?.displayName ?? auth.user?.name }}
        </span>
        <div class="navbar__role-row">
          <Tag
            :value="auth.effectiveUser?.role"
            :severity="roleSeverity"
            class="navbar__role-tag"
          />
        </div>
      </div>

      <Button
        icon="pi pi-sign-out"
        text
        rounded
        :aria-label="$t('nav.signOut')"
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

/* ── Dev view toggles ── */
.navbar__view-toggles {
  display: flex;
  align-items: center;
  gap: 2px;
  background: color-mix(in srgb, var(--ss-shell-fg) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--ss-shell-fg) 12%, transparent);
  border-radius: 99px;
  padding: 2px;
}

.view-pill {
  padding: 0.2rem 0.75rem;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border: none;
  border-radius: 99px;
  background: none;
  color: var(--ss-shell-fg-muted);
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
  white-space: nowrap;
}

.view-pill:hover {
  color: var(--ss-shell-fg);
  background: color-mix(in srgb, var(--ss-shell-fg) 8%, transparent);
}

.view-pill--active {
  background: var(--ss-primary);
  color: var(--ss-primary-fg);
}

.view-divider {
  display: block;
  width: 1px;
  height: 14px;
  background: color-mix(in srgb, var(--ss-shell-fg) 20%, transparent);
  margin: 0 2px;
  flex-shrink: 0;
}

/* ── End section ── */
.navbar__lang-toggle {
  display: flex;
  align-items: center;
  padding: 0.3rem 0.5rem !important;
  width: auto !important;
}

.navbar__lang-code {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.navbar__bell {
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

.navbar__role-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.navbar__role-tag {
  font-size: 0.65rem;
  padding: 0.1rem 0.4rem;
}

.navbar__dev-badge {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--ss-primary);
  opacity: 0.8;
}

@media (max-width: 767px) {
  .navbar__user {
    display: none;
  }

  .navbar__logout {
    display: none;
  }

  .navbar__view-toggles {
    gap: 1px;
    padding: 2px;
  }

  .view-pill {
    padding: 0.2rem 0.5rem;
    font-size: 0.65rem;
  }
}
</style>

<style>
/* Notification popover — unscoped so it targets the teleported overlay */
.notif-popover.p-popover {
  width: 340px;
  padding: 0;
  overflow: hidden;
}

.notif-popover__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem 0.6rem;
  border-bottom: 1px solid var(--ss-border);
}

.notif-popover__heading {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--ss-text);
}

.notif-popover__read-all {
  font-size: 0.75rem !important;
  padding: 0.15rem 0.4rem !important;
}

.notif-popover__list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 380px;
  overflow-y: auto;
}

.notif-popover__item {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.7rem 1rem;
  border-bottom: 1px solid var(--ss-border);
  position: relative;
  transition: background 0.1s;
}

.notif-popover__item:last-child {
  border-bottom: none;
}

.notif-popover__item--clickable {
  cursor: pointer;
}

.notif-popover__item--clickable:hover {
  background: color-mix(in srgb, var(--ss-primary) 5%, transparent);
}

.notif-popover__item--unread {
  background: color-mix(in srgb, var(--ss-primary) 4%, var(--ss-surface));
}

.notif-popover__icon {
  font-size: 0.85rem;
  color: var(--ss-text-muted);
  flex-shrink: 0;
  margin-top: 0.15rem;
}

.notif-popover__item--unread .notif-popover__icon {
  color: var(--ss-primary);
}

.notif-popover__body {
  flex: 1;
  min-width: 0;
}

.notif-popover__title {
  margin: 0 0 0.15rem;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--ss-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notif-popover__item--unread .notif-popover__title {
  font-weight: 700;
}

.notif-popover__msg {
  margin: 0;
  font-size: 0.72rem;
  color: var(--ss-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notif-popover__time {
  font-size: 0.68rem;
  color: var(--ss-text-subtle, #aaa);
  flex-shrink: 0;
  white-space: nowrap;
  margin-top: 0.1rem;
}

.notif-popover__dot {
  position: absolute;
  top: 0.8rem;
  right: 0.8rem;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ss-primary);
}

.notif-popover__empty {
  padding: 1.5rem;
  text-align: center;
  font-size: 0.82rem;
  color: var(--ss-text-muted);
  font-style: italic;
}

.notif-popover__footer {
  border-top: 1px solid var(--ss-border);
  padding: 0.6rem 1rem;
}

.notif-popover__all-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--ss-primary);
  text-decoration: none;
  transition: opacity 0.1s;
}

.notif-popover__all-link:hover {
  opacity: 0.75;
}
</style>
