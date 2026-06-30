<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Skeleton from 'primevue/skeleton'
import { sessionService, type AdminRoomSession } from '@/services/sessionService'
import { roomService, type Room } from '@/services/roomService'

const toast = useToast()

// ── Rooms ──────────────────────────────────────────────────────────────────

const rooms = ref<Room[]>([])
const newRoomName = ref('')
const addingRoom = ref(false)
const editingRoomId = ref<string | null>(null)
const editRoomName = ref('')
const savingRoom = ref(false)

async function loadRooms() {
  const result = await roomService.list()
  if (result.type === 'ok') rooms.value = result.data
}

async function addRoom() {
  const name = newRoomName.value.trim()
  if (!name) return
  addingRoom.value = true
  const result = await roomService.create(name)
  addingRoom.value = false
  if (result.type === 'ok') {
    rooms.value = [...rooms.value, result.data].sort((a, b) => a.name.localeCompare(b.name))
    newRoomName.value = ''
    toast.add({ severity: 'success', summary: `Ruimte '${name}' toegevoegd`, life: 3000 })
  } else {
    toast.add({ severity: 'error', summary: result.message, life: 5000 })
  }
}

function startEditRoom(room: Room) {
  editingRoomId.value = room.id
  editRoomName.value = room.name
}

function cancelEditRoom() {
  editingRoomId.value = null
  editRoomName.value = ''
}

async function saveRoomName(room: Room) {
  const name = editRoomName.value.trim()
  if (!name || name === room.name) { cancelEditRoom(); return }
  savingRoom.value = true
  const result = await roomService.update(room.id, { name })
  savingRoom.value = false
  if (result.type === 'ok') {
    const idx = rooms.value.findIndex(r => r.id === room.id)
    if (idx !== -1) rooms.value[idx] = result.data
    cancelEditRoom()
    toast.add({ severity: 'success', summary: 'Ruimte bijgewerkt', life: 3000 })
  } else {
    toast.add({ severity: 'error', summary: result.message, life: 5000 })
  }
}

async function toggleRoomActive(room: Room) {
  const result = await roomService.update(room.id, { isActive: !room.isActive })
  if (result.type === 'ok') {
    const idx = rooms.value.findIndex(r => r.id === room.id)
    if (idx !== -1) rooms.value[idx] = result.data
  } else {
    toast.add({ severity: 'error', summary: result.message, life: 5000 })
  }
}

async function deleteRoom(room: Room) {
  if (!confirm(`Ruimte '${room.name}' verwijderen?`)) return
  const result = await roomService.remove(room.id)
  if (result.type === 'ok') {
    rooms.value = rooms.value.filter(r => r.id !== room.id)
    toast.add({ severity: 'success', summary: 'Ruimte verwijderd', life: 3000 })
  } else {
    toast.add({ severity: 'error', summary: result.message, life: 5000 })
  }
}

// ── Room options for select ───────────────────────────────────────────────

const activeRoomOptions = computed(() => [
  { label: '— Geen ruimte —', value: null },
  ...rooms.value.filter(r => r.isActive).map(r => ({ label: r.name, value: r.name })),
])

// ── Sessions ──────────────────────────────────────────────────────────────

const sessions = ref<AdminRoomSession[]>([])
const loading = ref(false)
const editingSessionId = ref<string | null>(null)
const editAssignedRoom = ref<string | null>(null)
const saving = ref(false)

async function loadSessions() {
  loading.value = true
  const result = await sessionService.getWeekRooms()
  loading.value = false
  if (result.type === 'ok') {
    sessions.value = result.data
  } else {
    toast.add({ severity: 'error', summary: result.message, life: 5000 })
  }
}

onMounted(async () => {
  await Promise.all([loadRooms(), loadSessions()])
})

// ── Group by day ──────────────────────────────────────────────────────────

const byDay = computed(() => {
  const map = new Map<string, AdminRoomSession[]>()
  for (const s of sessions.value) {
    const key = new Date(s.date).toLocaleDateString('nl-NL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(s)
  }
  return [...map.entries()].map(([day, items]) => ({ day, items }))
})

// ── Room assignment ───────────────────────────────────────────────────────

function startEdit(session: AdminRoomSession) {
  editingSessionId.value = session.id
  editAssignedRoom.value = session.assignedRoom ?? null
}

function cancelEdit() {
  editingSessionId.value = null
  editAssignedRoom.value = null
}

async function saveRoom(session: AdminRoomSession) {
  if (saving.value) return
  saving.value = true
  const result = await sessionService.assignRoom(session.id, editAssignedRoom.value)
  saving.value = false
  if (result.type === 'ok') {
    session.assignedRoom = editAssignedRoom.value
    cancelEdit()
    toast.add({ severity: 'success', summary: 'Ruimte opgeslagen', life: 3000 })
  } else {
    toast.add({ severity: 'error', summary: result.message, life: 5000 })
  }
}

// ── Status display ────────────────────────────────────────────────────────

function statusSeverity(status: string) {
  if (status === 'confirmed') return 'success'
  if (status === 'open') return 'info'
  if (status === 'draft') return 'secondary'
  return 'secondary'
}
</script>

<template>
  <div class="ar-view">

    <!-- ── Room management ─────────────────────────────────────────────── -->
    <section class="ar-section">
      <h2 class="ar-section-title">Ruimtes beheren</h2>

      <!-- Add new room -->
      <div class="ar-add-room">
        <InputText
          v-model="newRoomName"
          placeholder="Naam nieuwe ruimte…"
          class="ar-add-input"
          maxlength="80"
          @keydown.enter="addRoom"
        />
        <Button
          label="Toevoegen"
          icon="pi pi-plus"
          size="small"
          :loading="addingRoom"
          :disabled="!newRoomName.trim()"
          @click="addRoom"
        />
      </div>

      <!-- Room list -->
      <div v-if="rooms.length" class="ar-room-list">
        <div
          v-for="room in rooms"
          :key="room.id"
          class="ar-room-item"
          :class="{ 'ar-room-item--inactive': !room.isActive }"
        >
          <!-- Name (editable) -->
          <template v-if="editingRoomId === room.id">
            <InputText
              v-model="editRoomName"
              class="ar-room-edit-input"
              maxlength="80"
              autofocus
              @keydown.enter="saveRoomName(room)"
              @keydown.esc="cancelEditRoom"
            />
            <Button icon="pi pi-check" size="small" :loading="savingRoom" @click="saveRoomName(room)" />
            <Button icon="pi pi-times" size="small" severity="secondary" text @click="cancelEditRoom" />
          </template>
          <template v-else>
            <span class="ar-room-name">{{ room.name }}</span>
            <Tag
              v-if="!room.isActive"
              value="Inactief"
              severity="secondary"
              class="ar-inactive-tag"
            />
            <div class="ar-room-actions">
              <Button icon="pi pi-pencil" size="small" severity="secondary" text :title="'Naam wijzigen'" @click="startEditRoom(room)" />
              <Button
                :icon="room.isActive ? 'pi pi-eye-slash' : 'pi pi-eye'"
                size="small"
                severity="secondary"
                text
                :title="room.isActive ? 'Deactiveren' : 'Activeren'"
                @click="toggleRoomActive(room)"
              />
              <Button icon="pi pi-trash" size="small" severity="danger" text :title="'Verwijderen'" @click="deleteRoom(room)" />
            </div>
          </template>
        </div>
      </div>
      <p v-else class="ar-no-rooms">Nog geen ruimtes. Voeg de eerste toe hierboven.</p>
    </section>

    <!-- ── Session room planning ──────────────────────────────────────── -->
    <div class="ar-header">
      <div>
        <h1 class="ar-title">Ruimteplanning</h1>
        <p class="ar-subtitle">Komende 7 dagen — wijs ruimtes toe aan sessies</p>
      </div>
      <Button
        icon="pi pi-refresh"
        severity="secondary"
        text
        :loading="loading"
        aria-label="Vernieuwen"
        @click="loadSessions"
      />
    </div>

    <!-- Loading skeleton -->
    <template v-if="loading">
      <div v-for="i in 3" :key="i" class="ar-day-group">
        <Skeleton height="1.2rem" width="12rem" class="ar-day-skeleton" />
        <div v-for="j in 2" :key="j" class="ar-row ar-row--skeleton">
          <Skeleton height="1rem" width="180px" />
          <Skeleton height="1rem" width="120px" />
          <Skeleton height="1rem" width="100px" />
          <Skeleton height="1rem" width="100px" />
          <Skeleton height="2rem" width="120px" />
        </div>
      </div>
    </template>

    <!-- Empty state -->
    <div v-else-if="sessions.length === 0" class="ar-empty">
      <i class="pi pi-calendar ar-empty-icon" />
      <p>Geen sessies de komende week.</p>
    </div>

    <!-- Sessions grouped by day -->
    <template v-else>
      <div v-for="group in byDay" :key="group.day" class="ar-day-group">
        <h2 class="ar-day-heading">{{ group.day }}</h2>

        <div class="ar-table">
          <div class="ar-table-header">
            <span>Sessie</span>
            <span>DM</span>
            <span>Standaard</span>
            <span>Gevraagd</span>
            <span>Toegewezen</span>
          </div>

          <div
            v-for="session in group.items"
            :key="session.id"
            class="ar-row"
          >
            <!-- Title + status -->
            <div class="ar-cell ar-cell--title">
              <span class="ar-session-title">{{ session.title }}</span>
              <Tag
                :value="session.status"
                :severity="statusSeverity(session.status)"
                class="ar-status-tag"
              />
            </div>

            <!-- DM -->
            <div class="ar-cell">
              {{ session.dm?.displayName ?? '—' }}
            </div>

            <!-- DM default room -->
            <div class="ar-cell ar-cell--room">
              <span v-if="session.dm?.defaultRoom" class="ar-room ar-room--default">
                {{ session.dm.defaultRoom }}
              </span>
              <span v-else class="ar-room ar-room--none">—</span>
            </div>

            <!-- Requested room -->
            <div class="ar-cell ar-cell--room">
              <span v-if="session.requestedRoom" class="ar-room ar-room--requested">
                {{ session.requestedRoom }}
              </span>
              <span v-else class="ar-room ar-room--none">—</span>
            </div>

            <!-- Assigned room (editable) -->
            <div class="ar-cell ar-cell--assign">
              <template v-if="editingSessionId === session.id">
                <Select
                  v-model="editAssignedRoom"
                  :options="activeRoomOptions"
                  option-label="label"
                  option-value="value"
                  class="ar-room-select"
                  placeholder="Ruimte kiezen…"
                />
                <Button
                  icon="pi pi-check"
                  size="small"
                  :loading="saving"
                  aria-label="Opslaan"
                  @click="saveRoom(session)"
                />
                <Button
                  icon="pi pi-times"
                  size="small"
                  severity="secondary"
                  text
                  :disabled="saving"
                  aria-label="Annuleren"
                  @click="cancelEdit"
                />
              </template>
              <template v-else>
                <span
                  class="ar-room"
                  :class="session.assignedRoom ? 'ar-room--assigned' : 'ar-room--empty'"
                >
                  {{ session.assignedRoom ?? 'Niet toegewezen' }}
                </span>
                <Button
                  icon="pi pi-pencil"
                  size="small"
                  severity="secondary"
                  text
                  aria-label="Ruimte bewerken"
                  @click="startEdit(session)"
                />
              </template>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ar-view {
  padding: 1.5rem;
  max-width: 1000px;
}

/* ── Room management section ─────────────────────────────────────────────── */

.ar-section {
  background: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  padding: 1.25rem;
  margin-bottom: 2rem;
}

.ar-section-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--ss-text);
  margin: 0 0 1rem;
}

.ar-add-room {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.ar-add-input {
  flex: 1;
  max-width: 320px;
}

.ar-room-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.ar-room-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  border-radius: var(--ss-radius-sm);
  background: var(--ss-surface-raised);
  border: 1px solid var(--ss-border);
  transition: background 0.1s;
}

.ar-room-item--inactive {
  opacity: 0.55;
}

.ar-room-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--ss-text);
  flex: 1;
}

.ar-inactive-tag {
  font-size: 0.65rem !important;
}

.ar-room-edit-input {
  flex: 1;
  max-width: 240px;
}

.ar-room-actions {
  display: flex;
  gap: 0.1rem;
  margin-left: auto;
  flex-shrink: 0;
}

.ar-no-rooms {
  font-size: 0.85rem;
  color: var(--ss-text-muted);
  margin: 0;
}

/* ── Header ──────────────────────────────────────────────────────────────── */

.ar-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.ar-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--ss-text);
  margin: 0 0 0.2rem;
}

.ar-subtitle {
  font-size: 0.85rem;
  color: var(--ss-text-muted);
  margin: 0;
}

/* ── Day group ───────────────────────────────────────────────────────────── */

.ar-day-group {
  margin-bottom: 2rem;
}

.ar-day-skeleton {
  margin-bottom: 0.75rem;
}

.ar-day-heading {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--ss-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 0.75rem;
}

/* ── Table ───────────────────────────────────────────────────────────────── */

.ar-table {
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius-sm);
  overflow: hidden;
}

.ar-table-header {
  display: grid;
  grid-template-columns: 2fr 1.2fr 1fr 1fr 1.8fr;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  background: var(--ss-surface-alt);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ss-text-muted);
  border-bottom: 1px solid var(--ss-border);
}

.ar-row {
  display: grid;
  grid-template-columns: 2fr 1.2fr 1fr 1fr 1.8fr;
  gap: 0.5rem;
  padding: 0.7rem 1rem;
  align-items: center;
  border-bottom: 1px solid var(--ss-border);
  transition: background 0.1s;
}

.ar-row:last-child {
  border-bottom: none;
}

.ar-row:hover {
  background: color-mix(in srgb, var(--ss-primary) 4%, transparent);
}

.ar-row--skeleton {
  gap: 1rem;
  padding: 0.9rem 1rem;
}

/* ── Cells ───────────────────────────────────────────────────────────────── */

.ar-cell {
  font-size: 0.875rem;
  color: var(--ss-text);
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.ar-cell--title {
  gap: 0.5rem;
  flex-wrap: wrap;
}

.ar-session-title {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ar-status-tag {
  font-size: 0.7rem;
  flex-shrink: 0;
}

.ar-cell--room {
  overflow: hidden;
}

.ar-cell--assign {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: nowrap;
}

/* ── Room chips ──────────────────────────────────────────────────────────── */

.ar-room {
  font-size: 0.82rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ar-room--none {
  color: var(--ss-text-muted);
}

.ar-room--default {
  font-weight: 600;
  color: var(--ss-text);
}

.ar-room--requested {
  color: var(--ss-primary);
  font-style: italic;
}

.ar-room--assigned {
  font-weight: 700;
  color: var(--ss-success, var(--ss-primary));
}

.ar-room--empty {
  color: var(--ss-text-muted);
  font-style: italic;
}

/* ── Inline edit ─────────────────────────────────────────────────────────── */

.ar-room-select {
  width: 160px;
  font-size: 0.85rem;
}

/* ── Empty ───────────────────────────────────────────────────────────────── */

.ar-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem 1rem;
  color: var(--ss-text-muted);
  font-size: 0.9rem;
}

.ar-empty-icon {
  font-size: 2rem;
  opacity: 0.4;
}
</style>
