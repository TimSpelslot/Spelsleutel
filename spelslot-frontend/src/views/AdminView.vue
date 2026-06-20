<script setup lang="ts">
import { ref, onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import Avatar from 'primevue/avatar'
import { adminService, type AdminUser } from '@/services/adminService'

const users = ref<AdminUser[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const editTarget = ref<AdminUser | null>(null)
const editRole = ref<'PLAYER' | 'DM' | 'ADMIN'>('PLAYER')
const editWorldbuilder = ref(false)
const editDndId = ref('')
const saving = ref(false)
const saveError = ref<string | null>(null)

const ROLE_OPTIONS = [
  { label: 'Player', value: 'PLAYER' },
  { label: 'DM', value: 'DM' },
  { label: 'Admin', value: 'ADMIN' },
] as const

onMounted(async () => {
  loading.value = true
  const result = await adminService.listUsers()
  loading.value = false
  if (result.type === 'ok') users.value = result.data
  else error.value = result.message
})

function openEdit(user: AdminUser) {
  editTarget.value = { ...user }
  editRole.value = user.role
  editWorldbuilder.value = user.isWorldbuilder
  editDndId.value = user.dndbeyondCharacterId ?? ''
  saveError.value = null
}

function closeEdit() {
  editTarget.value = null
}

async function saveEdit() {
  if (!editTarget.value) return
  saving.value = true
  saveError.value = null
  // Accept full DnD Beyond URL or plain numeric ID
  const rawDndId = editDndId.value.trim()
  const urlMatch = rawDndId.match(/dndbeyond\.com\/characters\/(\d+)/i)
  const normalizedDndId = urlMatch ? urlMatch[1] : (rawDndId || null)

  const result = await adminService.updateUser(editTarget.value.id, {
    role: editRole.value,
    isWorldbuilder: editWorldbuilder.value,
    dndbeyondCharacterId: normalizedDndId,
  })
  saving.value = false
  if (result.type === 'error') {
    saveError.value = result.message
    return
  }
  // Patch local list
  const idx = users.value.findIndex(u => u.id === result.data.id)
  if (idx !== -1) users.value[idx] = result.data
  closeEdit()
}

async function approveWorldbuilder(user: AdminUser) {
  const result = await adminService.updateUser(user.id, {
    isWorldbuilder: true,
    worldbuilderRequestPending: false,
  })
  if (result.type === 'ok') {
    const idx = users.value.findIndex(u => u.id === result.data.id)
    if (idx !== -1) users.value[idx] = result.data
    if (editTarget.value?.id === user.id) {
      editTarget.value = result.data
      editWorldbuilder.value = true
    }
  }
}

async function rejectWorldbuilder(user: AdminUser) {
  const result = await adminService.updateUser(user.id, {
    worldbuilderRequestPending: false,
  })
  if (result.type === 'ok') {
    const idx = users.value.findIndex(u => u.id === result.data.id)
    if (idx !== -1) users.value[idx] = result.data
    if (editTarget.value?.id === user.id) {
      editTarget.value = result.data
    }
  }
}

function roleSeverity(role: string): 'warn' | 'danger' | 'secondary' {
  if (role === 'ADMIN') return 'danger'
  if (role === 'DM') return 'warn'
  return 'secondary'
}

function roleLabel(role: string) {
  if (role === 'ADMIN') return 'Admin'
  if (role === 'DM') return 'DM'
  return 'Player'
}

function initials(user: AdminUser) {
  return (user.displayName || user.name).charAt(0).toUpperCase() || '?'
}
</script>

<template>
  <div class="admin-view">
    <h1 class="admin-view__title">Admin</h1>

    <section class="admin-section">
      <h2 class="admin-section__heading">
        <i class="pi pi-users admin-section__icon" />
        Users
      </h2>

      <div v-if="loading" class="admin-loading">
        <i class="pi pi-spin pi-spinner" /> Loading…
      </div>
      <div v-else-if="error" class="admin-error">{{ error }}</div>

      <DataTable
        v-else
        :value="users"
        class="admin-table"
        size="small"
        striped-rows
        :global-filter-fields="['displayName', 'email', 'role']"
      >
        <Column header="User" :sortable="false" style="min-width: 200px">
          <template #body="{ data }">
            <div class="admin-table__user">
              <Avatar
                :image="data.avatarUrl ?? undefined"
                :label="data.avatarUrl ? undefined : initials(data)"
                shape="circle"
                class="admin-table__avatar"
              />
              <div class="admin-table__user-info">
                <span class="admin-table__name">{{ data.displayName || data.name }}</span>
                <span class="admin-table__email">{{ data.email }}</span>
              </div>
            </div>
          </template>
        </Column>

        <Column header="Role" style="width: 100px">
          <template #body="{ data }">
            <Tag :value="roleLabel(data.role)" :severity="roleSeverity(data.role)" />
          </template>
        </Column>

        <Column header="Worldbuilder" style="width: 120px">
          <template #body="{ data }">
            <div class="admin-table__wb">
              <Tag
                v-if="data.isWorldbuilder"
                value="Yes"
                severity="success"
              />
              <Tag v-else value="No" severity="secondary" />
              <Tag
                v-if="data.worldbuilderRequestPending"
                value="Requested"
                severity="warn"
                class="admin-table__pending-tag"
              />
            </div>
          </template>
        </Column>

        <Column header="DnD Beyond" style="width: 130px">
          <template #body="{ data }">
            <span v-if="data.dndbeyondCharacterId" class="admin-table__dndbeyond">
              <i class="pi pi-link" />
              {{ data.dndbeyondCharacterId }}
            </span>
            <span v-else class="admin-table__empty">—</span>
          </template>
        </Column>

        <Column style="width: 80px; text-align: right">
          <template #body="{ data }">
            <Button
              icon="pi pi-pencil"
              text
              rounded
              size="small"
              aria-label="Edit"
              @click="openEdit(data)"
            />
          </template>
        </Column>
      </DataTable>
    </section>

    <!-- Edit dialog -->
    <Dialog
      :visible="!!editTarget"
      :header="editTarget ? (editTarget.displayName || editTarget.name) : ''"
      modal
      :draggable="false"
      class="admin-edit-dialog"
      @update:visible="closeEdit"
    >
      <template v-if="editTarget">
        <div class="admin-edit__fields">
          <!-- Role -->
          <div class="admin-edit__field">
            <label class="admin-edit__label">Role</label>
            <Select
              v-model="editRole"
              :options="ROLE_OPTIONS"
              option-label="label"
              option-value="value"
              class="admin-edit__select"
            />
          </div>

          <!-- Worldbuilder toggle -->
          <div class="admin-edit__field">
            <label class="admin-edit__label">Worldbuilder</label>
            <div class="admin-edit__toggle-row">
              <ToggleSwitch v-model="editWorldbuilder" />
              <span class="admin-edit__toggle-hint">
                {{ editWorldbuilder ? 'Can create and edit Codex entries' : 'Read-only access' }}
              </span>
            </div>
          </div>

          <!-- Worldbuilder request pending -->
          <div v-if="editTarget.worldbuilderRequestPending" class="admin-edit__field admin-edit__wb-request">
            <div class="admin-edit__wb-request-row">
              <Tag value="Requested" severity="warn" />
              <span class="admin-edit__wb-request-hint">Has requested worldbuilder access</span>
            </div>
            <div class="admin-edit__wb-actions">
              <Button
                label="Approve"
                icon="pi pi-check"
                size="small"
                severity="success"
                @click="approveWorldbuilder(editTarget)"
              />
              <Button
                label="Reject"
                icon="pi pi-times"
                size="small"
                severity="secondary"
                text
                @click="rejectWorldbuilder(editTarget)"
              />
            </div>
          </div>

          <!-- DnD Beyond character ID -->
          <div class="admin-edit__field">
            <label class="admin-edit__label">DnD Beyond Character ID</label>
            <InputText
              v-model="editDndId"
              placeholder="166911576 or full DnD Beyond URL"
              class="admin-edit__input"
            />
            <span class="admin-edit__hint">Paste the numeric ID or the full character URL — both work.</span>
          </div>

          <p v-if="saveError" class="admin-edit__error">{{ saveError }}</p>
        </div>
      </template>

      <template #footer>
        <Button label="Cancel" text @click="closeEdit" />
        <Button
          label="Save"
          icon="pi pi-check"
          :loading="saving"
          @click="saveEdit"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.admin-view {
  max-width: 960px;
  padding: 1.5rem;
}

.admin-view__title {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--ss-text);
  margin: 0 0 1.5rem;
}

/* ── Section ── */
.admin-section {
  background: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  overflow: hidden;
}

.admin-section__heading {
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

.admin-section__icon {
  color: var(--ss-primary);
}

/* ── States ── */
.admin-loading,
.admin-error {
  padding: 2rem;
  text-align: center;
  color: var(--ss-text-muted);
  font-size: 0.9rem;
}

.admin-error {
  color: var(--ss-danger);
}

/* ── Table cells ── */
.admin-table__user {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.admin-table__avatar {
  width: 28px;
  height: 28px;
  font-size: 0.75rem;
  flex-shrink: 0;
}

.admin-table__user-info {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
}

.admin-table__name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ss-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.admin-table__email {
  font-size: 0.72rem;
  color: var(--ss-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.admin-table__wb {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
}

.admin-table__pending-tag {
  font-size: 0.62rem !important;
}

.admin-table__dndbeyond {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: var(--ss-text-muted);
}

.admin-table__empty {
  color: var(--ss-text-subtle, #aaa);
}

/* ── Edit dialog ── */
.admin-edit__fields {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 320px;
  padding: 0.25rem 0;
}

.admin-edit__field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.admin-edit__label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ss-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.admin-edit__select,
.admin-edit__input {
  width: 100%;
}

.admin-edit__hint {
  font-size: 0.7rem;
  color: var(--ss-text-muted);
  opacity: 0.75;
}

.admin-edit__toggle-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.admin-edit__toggle-hint {
  font-size: 0.8rem;
  color: var(--ss-text-muted);
}

.admin-edit__wb-request {
  background: color-mix(in srgb, var(--ss-warning, #f59e0b) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--ss-warning, #f59e0b) 30%, transparent);
  border-radius: var(--ss-radius-sm, 6px);
  padding: 0.75rem;
  gap: 0.6rem;
}

.admin-edit__wb-request-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.admin-edit__wb-request-hint {
  font-size: 0.8rem;
  color: var(--ss-text-muted);
}

.admin-edit__wb-actions {
  display: flex;
  gap: 0.5rem;
}

.admin-edit__error {
  font-size: 0.85rem;
  color: var(--ss-danger);
  margin: 0;
}
</style>
