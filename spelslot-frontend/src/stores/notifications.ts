import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { notificationService, type AppNotification } from '@/services/notificationService'

const POLL_INTERVAL = 30_000

export const useNotificationsStore = defineStore('notifications', () => {
  const notifications = ref<AppNotification[]>([])
  const loading = ref(false)
  let pollHandle: ReturnType<typeof setInterval> | null = null

  const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)

  async function load() {
    loading.value = true
    const result = await notificationService.list()
    loading.value = false
    if (result.type === 'ok') notifications.value = result.data
  }

  async function markRead(id: string) {
    const result = await notificationService.markRead(id)
    if (result.type === 'ok') {
      const n = notifications.value.find(n => n._id === id)
      if (n) n.read = true
    }
  }

  async function markAllRead() {
    const result = await notificationService.markAllRead()
    if (result.type === 'ok') {
      notifications.value.forEach(n => { n.read = true })
    }
  }

  async function remove(id: string) {
    const result = await notificationService.remove(id)
    if (result.type === 'ok') {
      notifications.value = notifications.value.filter(n => n._id !== id)
    }
  }

  function startPolling() {
    load()
    if (!pollHandle) {
      pollHandle = setInterval(load, POLL_INTERVAL)
    }
  }

  function stopPolling() {
    if (pollHandle) {
      clearInterval(pollHandle)
      pollHandle = null
    }
  }

  return { notifications, loading, unreadCount, load, markRead, markAllRead, remove, startPolling, stopPolling }
})
