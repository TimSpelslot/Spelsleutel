<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Button from 'primevue/button'
import ToggleSwitch from 'primevue/toggleswitch'
import { useNotificationsStore } from '@/stores/notifications'
import { useAuthStore } from '@/stores/auth'
import { notificationService } from '@/services/notificationService'
import { useFcm } from '@/composables/useFcm'
import { useRouter } from 'vue-router'

const store = useNotificationsStore()
const auth = useAuthStore()
const router = useRouter()
const fcm = useFcm()

// ── Push permission state ────────────────────────────────────────────────
const pushPermission = ref<NotificationPermission>(
  'Notification' in window ? Notification.permission : 'denied',
)
const enablingPush = ref(false)

async function enablePush() {
  enablingPush.value = true
  const result = await fcm.requestAndInit()
  pushPermission.value = result
  enablingPush.value = false
}

// ── Preferences local state ──────────────────────────────────────────────
const prefs = ref({
  notifySignup: auth.user?.notifySignup ?? true,
  notifyAssignment: auth.user?.notifyAssignment ?? true,
  notifyMarketplace: auth.user?.notifyMarketplace ?? true,
  notifySession: auth.user?.notifySession ?? true,
})
const savingPrefs = ref(false)
const prefsSaved = ref(false)
let saveTimer: ReturnType<typeof setTimeout> | null = null

function savePrefs() {
  prefsSaved.value = false
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    savingPrefs.value = true
    const result = await notificationService.updatePreferences(prefs.value)
    savingPrefs.value = false
    if (result.type === 'ok') {
      prefsSaved.value = true
      setTimeout(() => { prefsSaved.value = false }, 2000)
    }
  }, 400)
}

onMounted(() => store.load())

// ── Helpers ──────────────────────────────────────────────────────────────
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
  if (m < 1) return 'Just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.floor(h / 24)
  if (d === 1) return 'Yesterday'
  if (d < 7) return `${d} days ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

async function handleClick(id: string, href?: string) {
  await store.markRead(id)
  if (href) router.push(href)
}
</script>

<template>
  <div class="notif-view">
    <div class="notif-view__header">
      <h1 class="notif-view__title">Notifications</h1>
      <Button
        v-if="store.unreadCount > 0"
        label="Mark all as read"
        icon="pi pi-check-square"
        text
        size="small"
        @click="store.markAllRead"
      />
    </div>

    <!-- Notification list -->
    <section class="notif-section">
      <div v-if="store.loading && store.notifications.length === 0" class="notif-state">
        <i class="pi pi-spin pi-spinner" /> Loading…
      </div>

      <div v-else-if="store.notifications.length === 0" class="notif-state notif-state--empty">
        <i class="pi pi-bell-slash notif-state__icon" />
        <p>No notifications</p>
      </div>

      <ul v-else class="notif-list">
        <li
          v-for="n in store.notifications"
          :key="n._id"
          class="notif-item"
          :class="{ 'notif-item--unread': !n.read, 'notif-item--clickable': !!n.href }"
          @click="handleClick(n._id, n.href)"
        >
          <div class="notif-item__icon-wrap">
            <i :class="['notif-item__icon', typeIcon(n.type)]" />
            <span v-if="!n.read" class="notif-item__dot" />
          </div>
          <div class="notif-item__body">
            <p class="notif-item__title">{{ n.title }}</p>
            <p class="notif-item__message">{{ n.message }}</p>
            <span class="notif-item__time">{{ timeAgo(n.createdAt) }}</span>
          </div>
          <Button
            icon="pi pi-times"
            text
            rounded
            size="small"
            class="notif-item__delete"
            aria-label="Delete"
            @click.stop="store.remove(n._id)"
          />
        </li>
      </ul>
    </section>

    <!-- Push permission -->
    <section class="notif-section notif-push">
      <h2 class="notif-section__heading">
        <i class="pi pi-mobile notif-section__icon" />
        Push notifications
      </h2>
      <div class="notif-push__body">
        <template v-if="pushPermission === 'granted'">
          <i class="pi pi-check-circle notif-push__icon notif-push__icon--ok" />
          <div class="notif-push__text">
            <span class="notif-push__label">Enabled on this device</span>
            <span class="notif-push__hint">You'll receive push notifications in your browser.</span>
          </div>
        </template>
        <template v-else-if="pushPermission === 'denied'">
          <i class="pi pi-ban notif-push__icon notif-push__icon--blocked" />
          <div class="notif-push__text">
            <span class="notif-push__label">Blocked in your browser</span>
            <span class="notif-push__hint">
              To re-enable, click the lock icon in your browser's address bar,
              find the Notifications setting, and change it to Allow.
            </span>
          </div>
        </template>
        <template v-else>
          <i class="pi pi-bell notif-push__icon" />
          <div class="notif-push__text">
            <span class="notif-push__label">Not enabled on this device</span>
            <span class="notif-push__hint">Enable to receive notifications even when the app is not open.</span>
          </div>
          <Button
            label="Enable"
            icon="pi pi-bell"
            size="small"
            :loading="enablingPush"
            @click="enablePush"
          />
        </template>
      </div>
    </section>

    <!-- Preferences -->
    <section class="notif-section notif-prefs">
      <h2 class="notif-section__heading">
        <i class="pi pi-sliders-h notif-section__icon" />
        Notification preferences
      </h2>

      <div class="notif-prefs__list">
        <div class="notif-prefs__row">
          <div class="notif-prefs__info">
            <span class="notif-prefs__label">Sign-ups</span>
            <span class="notif-prefs__hint">When a session you signed up for changes</span>
          </div>
          <ToggleSwitch v-model="prefs.notifySignup" @change="savePrefs" />
        </div>

        <div class="notif-prefs__row">
          <div class="notif-prefs__info">
            <span class="notif-prefs__label">Assignment</span>
            <span class="notif-prefs__hint">When you are assigned to a session</span>
          </div>
          <ToggleSwitch v-model="prefs.notifyAssignment" @change="savePrefs" />
        </div>

        <div class="notif-prefs__row">
          <div class="notif-prefs__info">
            <span class="notif-prefs__label">Marketplace</span>
            <span class="notif-prefs__hint">Updates about items and transactions</span>
          </div>
          <ToggleSwitch v-model="prefs.notifyMarketplace" @change="savePrefs" />
        </div>

        <div class="notif-prefs__row">
          <div class="notif-prefs__info">
            <span class="notif-prefs__label">Sessions</span>
            <span class="notif-prefs__hint">Session notes creation and updates</span>
          </div>
          <ToggleSwitch v-model="prefs.notifySession" @change="savePrefs" />
        </div>
      </div>

      <p v-if="prefsSaved" class="notif-prefs__saved">
        <i class="pi pi-check" /> Saved
      </p>
    </section>
  </div>
</template>

<style scoped>
.notif-view {
  max-width: 680px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.notif-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.notif-view__title {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--ss-text);
  margin: 0;
}

/* ── Section ── */
.notif-section {
  background: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  overflow: hidden;
}

.notif-section__heading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--ss-text);
  padding: 1rem 1.25rem;
  margin: 0;
  border-bottom: 1px solid var(--ss-border);
}

.notif-section__icon {
  color: var(--ss-primary);
}

/* ── States ── */
.notif-state {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 2.5rem;
  text-align: center;
  justify-content: center;
  color: var(--ss-text-muted);
  font-size: 0.9rem;
}

.notif-state--empty {
  flex-direction: column;
  gap: 0.5rem;
}

.notif-state__icon {
  font-size: 2rem;
  color: var(--ss-text-subtle, #ccc);
}

/* ── List ── */
.notif-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.notif-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid var(--ss-border);
  transition: background 0.12s;
}

.notif-item:last-child {
  border-bottom: none;
}

.notif-item--clickable {
  cursor: pointer;
}

.notif-item--clickable:hover {
  background: color-mix(in srgb, var(--ss-primary) 4%, transparent);
}

.notif-item--unread {
  background: color-mix(in srgb, var(--ss-primary) 5%, var(--ss-surface));
}

.notif-item__icon-wrap {
  position: relative;
  flex-shrink: 0;
  margin-top: 0.15rem;
}

.notif-item__icon {
  font-size: 1rem;
  color: var(--ss-text-muted);
}

.notif-item--unread .notif-item__icon {
  color: var(--ss-primary);
}

.notif-item__dot {
  position: absolute;
  top: -2px;
  right: -3px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ss-primary);
  border: 1.5px solid var(--ss-surface);
}

.notif-item__body {
  flex: 1;
  min-width: 0;
}

.notif-item__title {
  margin: 0 0 0.2rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--ss-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notif-item--unread .notif-item__title {
  font-weight: 600;
}

.notif-item__message {
  margin: 0 0 0.25rem;
  font-size: 0.8rem;
  color: var(--ss-text-muted);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.notif-item__time {
  font-size: 0.72rem;
  color: var(--ss-text-subtle, #aaa);
}

.notif-item__delete {
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s;
}

.notif-item:hover .notif-item__delete {
  opacity: 1;
}

/* ── Push ── */
.notif-push__body {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
}

.notif-push__icon {
  font-size: 1.2rem;
  color: var(--ss-text-muted);
  flex-shrink: 0;
}

.notif-push__icon--ok { color: var(--ss-success, #22c55e); }
.notif-push__icon--blocked { color: var(--ss-danger); }

.notif-push__text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  flex: 1;
  min-width: 0;
}

.notif-push__label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--ss-text);
}

.notif-push__hint {
  font-size: 0.78rem;
  color: var(--ss-text-muted);
  line-height: 1.4;
}

/* ── Preferences ── */
.notif-prefs__list {
  padding: 0.5rem 0;
}

.notif-prefs__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 1.25rem;
}

.notif-prefs__row + .notif-prefs__row {
  border-top: 1px solid var(--ss-border);
}

.notif-prefs__info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.notif-prefs__label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--ss-text);
}

.notif-prefs__hint {
  font-size: 0.78rem;
  color: var(--ss-text-muted);
}

.notif-prefs__saved {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1.25rem;
  font-size: 0.8rem;
  color: var(--ss-success, #22c55e);
  border-top: 1px solid var(--ss-border);
  margin: 0;
}
</style>
